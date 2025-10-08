
const profileBtn = document.getElementById('profileBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
profileBtn.addEventListener('click', () => {
  dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
});
document.addEventListener('click', (e) => {
  if (!profileBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
    dropdownMenu.style.display = 'none';
  }
});

// Theme toggle
const themeSelect = document.getElementById('themeSelect');
themeSelect.addEventListener('change', () => {
  document.body.classList.remove('light','dark');
  if (themeSelect.value === 'light') document.body.classList.add('light');
  else if (themeSelect.value === 'dark') document.body.classList.add('dark');
  else { // system
    if(window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.add('light');
    }
  }
});

// Dummy send message
const sendBtn = document.getElementById('sendBtn');
const input = document.getElementById('input');
const log = document.getElementById('log');

sendBtn.addEventListener('click', () => {
  if(input.value.trim() === '') return;
  const li = document.createElement('li');
  li.classList.add('me');
  li.textContent = input.value;
  log.appendChild(li);
  input.value = '';
});
