const toggleConnectionBtn = document.getElementById('toggleConnectionBtn')
const chatInput = document.getElementById('chatInput');

const terminal = new BluetoothTerminal('Stair Led', '6e400001-b5a3-f393-e0a9-e50e24dcca9e')

terminal.receive = function (data) {
    console.log(data)
    addToChat(data, 'green')
};

terminal._log = function (...messages) {
    messages.forEach((message) => {
        console.log(message);
        addToChat(message, 'black')
    });
};

terminal.onConnectionChanged = function (connected) {
    console.log('Connection changed to ' + connected);
    setBluetoothIcon(terminal.isConnected())
}

function logToTerminal(message, type) {
    console.log(message)
}

toggleConnectionBtn.addEventListener('click', () => {
    terminal.connect().
        catch((error) => addToChat(error, 'red'));
})

chatInput.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        const message = chatInput.value.trim();
        if (message) {
            terminal.send(message).
                then(() => addToChat(message, 'blue')).
                catch((error) => addToChat(error, 'red'))

            chatInput.value = ''
        }
    }
});

