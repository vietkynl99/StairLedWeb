// Client -> Server
const BLE_CMD_SEND_CMD = 100;

// Server -> Client
const BLE_CMD_RESP_CMD = 150;
const BLE_CMD_LOG = 151;

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

function parseMessage(message) {
    if (message.startsWith('[Main] BLE MTU')) {
        const parts = message.split(' ');
        const value = parseInt(parts[parts.length - 1]);
        if (!isNaN(value)) {
            if (mtuSize != value) {
                console.log("Get MTU size: " + mtuSize);
                sendCommand(BLE_CMD_SEND_CMD, 'ble-mtu ' + mtuSize);
            }
        }
    }
}

terminal.receive = (command, data) => {
    console.log('Received command:', command);
    switch (command) {
        case BLE_CMD_RESP_CMD:
        case BLE_CMD_LOG:
            {
                const message = new TextDecoder().decode(data).trim();
                addToChat(message, 'green');
                parseMessage(message);
                break;
            }
        default:
            console.warn('Unhandled command: ' + command);
            break;
    }
}

terminal._log = log

terminal.onConnectionChanged = function (connected) {
    log('Connection changed to ' + connected)
    setBluetoothIcon(terminal.isConnected())
    if (connected) {
        sendCommand(BLE_CMD_SEND_CMD, 'ble-mtu');
    }
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

