function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

function setBluetoothIcon(connected) {
    const iconElement = document.getElementById('bluetooth-icon');
    iconElement.textContent = connected ? 'bluetooth' : 'bluetooth_disabled';
}

function addToChat(message, color = 'black') {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const secs = now.getSeconds().toString().padStart(2, '0');
    const formattedTime = `[${hours}:${minutes}:${secs}]`;

    const chatMessages = document.getElementById('chatMessages');
    const messageElem = document.createElement('div');
    messageElem.textContent = formattedTime + ' ' + message;
    messageElem.style.color = color;
    chatMessages.appendChild(messageElem);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateSlider(id) {
    document.getElementById(id + 'Value').innerText = document.getElementById(id).value;
}

function setEnable(enable) {
    const inputs = document.querySelectorAll('input, select, button');
    inputs.forEach(input => {
        input.disabled = !enable;
    });
    if (enable) {
        document.getElementById('uploadBtn').innerText = 'Update'
    }
}

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    notification.innerText = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}
