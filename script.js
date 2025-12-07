const socket = io();
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const characterSelect = document.getElementById('character-select');
const createBtn = document.getElementById('create-character-btn');
const editBtn = document.getElementById('edit-character-btn');
const deleteBtn = document.getElementById('delete-character-btn');
const createForm = document.getElementById('create-character-form');
const newNameInput = document.getElementById('new-name');
const newAvatarFile = document.getElementById('new-avatar-file');
const newAvatarUrl = document.getElementById('new-avatar-url');
const newHpInput = document.getElementById('new-hp');
const newArmorInput = document.getElementById('new-armor');
const newStrengthInput = document.getElementById('new-strength');
const saveBtn = document.getElementById('save-character-btn');
const cancelBtn = document.getElementById('cancel-create-btn');
const loginContainer = document.getElementById('login-container');
const app = document.getElementById('app');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const loginError = document.getElementById('login-error');
const quickPhrasesDiv = document.getElementById('quick-phrases');
const phraseNumber = document.getElementById('phrase-number');
const phraseText = document.getElementById('phrase-text');
const savePhraseBtn = document.getElementById('save-phrase-btn');
const oocToggle = document.getElementById('ooc-toggle');
const combatBtn = document.getElementById('combat-btn');
const logoutBtn = document.getElementById('logout-btn');
const toggleCharactersBtn = document.getElementById('toggle-characters-btn');

let userId = localStorage.getItem('user_id');
let characters = [];
let editingCharacterId = null;
let quickPhrases = {};
const themeToggle = document.getElementById('theme-toggle');

// Theme toggle
const currentTheme = localStorage.getItem('theme') || 'light';
document.body.classList.toggle('dark', currentTheme === 'dark');
themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
});

// Auto-login
if (userId) {
    showApp();
    loadCharacters();
    loadMessages();
} else {
    showLogin();
}

loginBtn.addEventListener('click', login);
registerBtn.addEventListener('click', register);

function showLogin() {
    loginContainer.style.display = 'block';
    app.style.display = 'none';
}

function showApp() {
    loginContainer.style.display = 'none';
    app.style.display = 'flex';
    loadQuickPhrases();
}

async function login() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (data.success) {
        userId = data.user_id;
        localStorage.setItem('user_id', userId);
        showApp();
        loadCharacters();
        loadMessages();
    } else {
        loginError.textContent = data.error;
    }
}

async function register() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (data.success) {
        loginError.textContent = 'Регистрация успешна. Пожалуйста, войдите.';
    } else {
        loginError.textContent = data.error;
    }
}

async function loadCharacters() {
    const response = await fetch(`/characters/${userId}`);
    characters = await response.json();
    characterSelect.innerHTML = '<option value="">Выберите персонажа</option>';
    characters.forEach((char) => {
        const option = document.createElement('option');
        option.value = char.id;
        option.textContent = char.name;
        characterSelect.appendChild(option);
    });
    updateCharacterButtons();
}

async function loadQuickPhrases() {
    const response = await fetch(`/quick-phrases/${userId}`);
    quickPhrases = await response.json();
    quickPhrasesDiv.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
        const div = document.createElement('div');
        div.textContent = `${i}: ${quickPhrases[i] || 'Не установлено'}`;
        quickPhrasesDiv.appendChild(div);
    }
}

savePhraseBtn.addEventListener('click', async () => {
    const number = parseInt(phraseNumber.value);
    const phrase = phraseText.value.trim();
    if (number >= 1 && number <= 10 && phrase) {
        await fetch('/quick-phrase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, number, phrase })
        });
        loadQuickPhrases();
        phraseNumber.value = '';
        phraseText.value = '';
    }
});

function updateCharacterButtons() {
    const selected = characterSelect.value;
    editBtn.style.display = selected ? 'inline-block' : 'none';
    deleteBtn.style.display = selected ? 'inline-block' : 'none';
}

characterSelect.addEventListener('change', updateCharacterButtons);

async function loadMessages() {
    const response = await fetch('/messages');
    const msgs = await response.json();
    msgs.forEach(msg => displayMessage(msg.name, msg.avatar, msg.message, msg.type));
}

socket.on('message', (data) => {
    displayMessage(data.name, data.avatar, data.message, data.type);
});

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

createBtn.addEventListener('click', () => {
    editingCharacterId = null;
    createForm.style.display = 'block';
});

editBtn.addEventListener('click', () => {
    const selectedId = characterSelect.value;
    const char = characters.find(c => c.id == selectedId);
    if (char) {
        editingCharacterId = char.id;
        newNameInput.value = char.name;
        newHpInput.value = char.hp;
        newArmorInput.value = char.armor;
        newStrengthInput.value = char.strength;
        createForm.style.display = 'block';
    }
});

deleteBtn.addEventListener('click', async () => {
    const selectedId = characterSelect.value;
    if (confirm('Удалить этого персонажа?')) {
        await fetch(`/character/${selectedId}`, { method: 'DELETE' });
        loadCharacters();
    }
});

saveBtn.addEventListener('click', saveCharacter);
cancelBtn.addEventListener('click', () => {
    createForm.style.display = 'none';
    newNameInput.value = '';
    newAvatarFile.value = '';
    newAvatarUrl.value = '';
    newHpInput.value = '100';
    newArmorInput.value = '0';
    newStrengthInput.value = '10';
    editingCharacterId = null;
});

async function saveCharacter() {
    const name = newNameInput.value.trim();
    const hp = newHpInput.value;
    const armor = newArmorInput.value;
    const strength = newStrengthInput.value;
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('name', name);
    formData.append('hp', hp);
    formData.append('armor', armor);
    formData.append('strength', strength);
    if (newAvatarFile.files[0]) {
        formData.append('avatar', newAvatarFile.files[0]);
    }
    const url = editingCharacterId ? `/character/${editingCharacterId}` : '/character';
    const method = editingCharacterId ? 'PUT' : 'POST';
    const response = await fetch(url, { method, body: formData });
    const data = await response.json();
    if (data.success) {
        createForm.style.display = 'none';
        newNameInput.value = '';
        newAvatarFile.value = '';
        newAvatarUrl.value = '';
        newHpInput.value = '100';
        newArmorInput.value = '0';
        newStrengthInput.value = '10';
        editingCharacterId = null;
        loadCharacters();
    } else {
        alert(data.error);
    }
}

function sendMessage() {
    const selectedId = characterSelect.value;
    if (selectedId === '') return;
    const char = characters.find(c => c.id == selectedId);
    let message = messageInput.value.trim();
    let type = 'rp';
    if (message) {
        if (message.startsWith('//')) {
            const num = parseInt(message.slice(2));
            if (quickPhrases[num]) {
                message = quickPhrases[num];
            } else {
                return; // Invalid
            }
        } else if (message.startsWith('/roll')) {
            const roll = Math.floor(Math.random() * 20) + 1;
            message = `rolls a d20: ${roll}`;
        } else if (message.startsWith('*') && message.endsWith('*')) {
            type = 'action';
            message = message.slice(1, -1);
        }
        if (oocToggle.checked) {
            type = 'ooc';
        }
        const data = { user_id: userId, name: char.name, avatar: char.avatar, message: message, type: type };
        socket.emit('message', data);
        displayMessage(char.name, char.avatar, message, type); // Show own message
        messageInput.value = '';
    }
}

function displayMessage(name, avatar, message, type = 'rp') {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    const avatarImg = avatar ? `<img src="${avatar}" alt="avatar" style="width:30px; height:30px; border-radius:50%; margin-right:5px;">` : '';
    let prefix = '';
    if (type === 'ooc') {
        prefix = '[OOC] ';
    } else if (type === 'action') {
        messageElement.innerHTML = `${avatarImg}<em>${name} ${message}</em>`;
        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return;
    }
    messageElement.innerHTML = `${avatarImg}<strong>${prefix}${name}:</strong> ${message}`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

combatBtn.addEventListener('click', () => {
    const selectedId = characterSelect.value;
    if (selectedId === '') return;
    const char = characters.find(c => c.id == selectedId);
    const data = { user_id: userId, name: char.name, avatar: char.avatar, message: 'начинает бой!', type: 'action' };
    socket.emit('message', data);
    displayMessage(char.name, char.avatar, 'начинает бой!', 'action');
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('user_id');
    userId = null;
    showLogin();
});

toggleCharactersBtn.addEventListener('click', () => {
    const container = document.getElementById('character-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
});