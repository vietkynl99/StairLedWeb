const connectButton = document.getElementById('connect-btn')
const sendButton = document.getElementById('send-btn')
const inputData = document.getElementById('input-data')
const outputDiv = document.getElementById('output')


const terminal = new BluetoothTerminal('ESP32')

terminal.receive = function (data) {
    // logToTerminal(data, 'in');
    console.log(data)
};

// Override default log method to output messages to the terminal and console.
terminal._log = function (...messages) {
    messages.forEach((message) => {
        // logToTerminal(message);
        console.log(message); // eslint-disable-line no-console
    });
};

function logToTerminal(message, type) {
    console.log(message)
}

function sendData() {
    const data = inputData.value;
    if (data) {
        terminal.send(data).
            then(() => logToTerminal(data, 'out')).
            catch((error) => logToTerminal(error));

        inputData.value = ''
    }
}

connectButton.addEventListener('click', () => {
    terminal.connect()
})

inputData.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        sendData();
    }
});

sendButton.addEventListener('click', () => {
    sendData()
})
