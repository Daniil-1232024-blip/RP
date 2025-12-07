from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
import os
import sqlite3
import hashlib
import uuid

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Database setup
def init_db():
    conn = sqlite3.connect('rp_chat.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS characters
                 (id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT UNIQUE, avatar TEXT, hp INTEGER DEFAULT 100, armor INTEGER DEFAULT 0, strength INTEGER DEFAULT 10)''')
    # Add columns if not exist
    try:
        c.execute("ALTER TABLE characters ADD COLUMN hp INTEGER DEFAULT 100")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE characters ADD COLUMN armor INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE characters ADD COLUMN strength INTEGER DEFAULT 10")
    except sqlite3.OperationalError:
        pass
    c.execute('''CREATE TABLE IF NOT EXISTS abilities
                 (id INTEGER PRIMARY KEY, character_id INTEGER, category TEXT, name TEXT, damage INTEGER DEFAULT 0, armor INTEGER DEFAULT 0, description TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS quick_phrases
                 (id INTEGER PRIMARY KEY, user_id INTEGER, number INTEGER, phrase TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS messages
                 (id INTEGER PRIMARY KEY, user_id INTEGER, character_name TEXT, avatar TEXT, message TEXT, type TEXT DEFAULT 'rp', timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    # Add type column if not exists (for existing DBs)
    try:
        c.execute("ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'rp'")
    except sqlite3.OperationalError:
        pass  # Column already exists
    conn.commit()
    conn.close()

init_db()

# Ensure avatars directory exists
if not os.path.exists('static/avatars'):
    os.makedirs('static/avatars')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/style.css')
def style():
    return send_from_directory('.', 'style.css')

@app.route('/script.js')
def script():
    return send_from_directory('.', 'script.js')

@app.route('/static/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data['username']
    password = hashlib.sha256(data['password'].encode()).hexdigest()
    conn = sqlite3.connect('rp_chat.db')
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
        conn.commit()
        return jsonify({'success': True})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Username already exists'})
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data['username']
    password = hashlib.sha256(data['password'].encode()).hexdigest()
    conn = sqlite3.connect('rp_chat.db')
    c = conn.cursor()
    c.execute("SELECT id FROM users WHERE username=? AND password=?", (username, password))
    user = c.fetchone()
    conn.close()
    if user:
        return jsonify({'success': True, 'user_id': user[0]})
    else:
        return jsonify({'success': False, 'error': 'Invalid credentials'})

@app.route('/characters/<int:user_id>')
def get_characters(user_id):
    conn = sqlite3.connect('rp_chat.db')
    c = conn.cursor()
    c.execute("SELECT id, name, avatar, hp, armor, strength FROM characters WHERE user_id=?", (user_id,))
    characters = [{'id': row[0], 'name': row[1], 'avatar': row[2], 'hp': row[3], 'armor': row[4], 'strength': row[5]} for row in c.fetchall()]
    conn.close()
    return jsonify(characters)

@app.route('/character', methods=['POST'])
def create_character():
    data = request.form
    user_id = data['user_id']
    name = data['name']
    hp = int(data.get('hp', 100))
    armor = int(data.get('armor', 0))
    strength = int(data.get('strength', 10))
    avatar_file = request.files.get('avatar')
    avatar_url = ''
    if avatar_file:
        filename = str(uuid.uuid4()) + os.path.splitext(avatar_file.filename)[1]
        avatar_file.save(os.path.join('static/avatars', filename))
        avatar_url = f'/static/avatars/{filename}'
    conn = sqlite3.connect('rp_chat.db')
    c = conn.cursor()
    try:
        c.execute("INSERT INTO characters (user_id, name, avatar, hp, armor, strength) VALUES (?, ?, ?, ?, ?, ?)", (user_id, name, avatar_url, hp, armor, strength))
        char_id = c.lastrowid
        # Add default abilities if any
        conn.commit()
        return jsonify({'success': True, 'id': char_id})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Имя персонажа уже существует'})
    finally:
        conn.close()

@app.route('/character/<int:char_id>', methods=['PUT'])
def update_character(char_id):
    data = request.form
    name = data.get('name')
    hp = int(data.get('hp', 100))
    armor = int(data.get('armor', 0))
    strength = int(data.get('strength', 10))
    avatar_file = request.files.get('avatar')
    avatar_url = data.get('avatar_url', '')
    if avatar_file:
        filename = str(uuid.uuid4()) + os.path.splitext(avatar_file.filename)[1]
        avatar_file.save(os.path.join('static/avatars', filename))
        avatar_url = f'/static/avatars/{filename}'
    conn = sqlite3.connect('rp_chat.db')
    c = conn.cursor()
    c.execute("UPDATE characters SET name=?, avatar=?, hp=?, armor=?, strength=? WHERE id=?", (name, avatar_url, hp, armor, strength, char_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/character/<int:char_id>', methods=['DELETE'])
def delete_character(char_id):
    conn = sqlite3.connect('rp_chat.db')
    c = conn.cursor()
    c.execute("DELETE FROM characters WHERE id=?", (char_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/quick-phrases/<int:user_id>')
def get_quick_phrases(user_id):
    conn = sqlite3.connect('rp_chat.db')
    c = conn.cursor()
    c.execute("SELECT number, phrase FROM quick_phrases WHERE user_id=? ORDER BY number", (user_id,))
    phrases = {row[0]: row[1] for row in c.fetchall()}
    conn.close()
    return jsonify(phrases)

@app.route('/quick-phrase', methods=['POST'])
def set_quick_phrase():
    data = request.json
    user_id = data['user_id']
    number = data['number']
    phrase = data['phrase']
    conn = sqlite3.connect('rp_chat.db')
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO quick_phrases (user_id, number, phrase) VALUES (?, ?, ?)", (user_id, number, phrase))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/messages')
def get_messages():
    conn = sqlite3.connect('rp_chat.db')
    c = conn.cursor()
    c.execute("SELECT character_name, avatar, message, timestamp FROM messages ORDER BY timestamp DESC LIMIT 50")
    messages = [{'name': row[0], 'avatar': row[1], 'message': row[2], 'timestamp': row[3]} for row in c.fetchall()]
    conn.close()
    return jsonify(messages[::-1])  # Reverse to chronological order

@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('message')
def handle_message(data):
    # Save message to DB
    conn = sqlite3.connect('rp_chat.db')
    c = conn.cursor()
    c.execute("INSERT INTO messages (user_id, character_name, avatar, message, type) VALUES (?, ?, ?, ?, ?)",
              (data.get('user_id'), data['name'], data.get('avatar', ''), data['message'], data.get('type', 'rp')))
    conn.commit()
    conn.close()
    # Broadcast to all clients
    emit('message', data, broadcast=True, include_self=False)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)