// BLE  command
const BLE_CMD_SEND_CMD = 100;
const BLE_CMD_RESP_CMD = 101;

let mtuSize = 23;

const toggleConnectionBtn = document.getElementById('toggleConnectionBtn')
const chatInput = document.getElementById('chatInput')

const terminal = new BluetoothTerminal('Stair Led', '013052ff-8771-46a9-89f8-eedbedd76935')

terminal.setMtuSize(mtuSize);

function log(message, type = 'debug') {
    console.log(message)
    addToChat(message, type === 'error' ? 'red' : 'black')
}

function sendCommand(command, data = null, onProgress = null) {
    terminal._sendCommand(command, data, onProgress).
        catch((error) => log(error, 'error'))
}

terminal.receive = (command, data) => {
    console.log('Received command:', command);
    switch (command) {
        case BLE_CMD_RESP_CMD:
            const message = new TextDecoder().decode(data).trim();
            addToChat(message, 'green');
            break;
        default:
            console.log('Unhandled command: ' + command);
            break;
    }
}

terminal._log = log

terminal.onConnectionChanged = function (connected) {
    log('Connection changed to ' + connected)
    setBluetoothIcon(terminal.isConnected())
}

toggleConnectionBtn.addEventListener('click', () => {
    terminal.connect().
        catch((error) => log(error, 'error'))
})

chatInput.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        const message = chatInput.value.trim()
        if (message) {
            addToChat(message, 'blue');
            sendCommand(BLE_CMD_SEND_CMD, message);

            chatInput.value = ''
        }
    }
})

