// BLE command Client -> server
const BLE_CMD_GET_MTU = 1;
const BLE_CMD_SET_MTU = 2;
const BLE_CMD_START_OTA = 3;
const BLE_CMD_STOP_OTA = 4;

// BLE command Server -> client
const BLE_CMD_NOTIFY_MTU = 50;
const BLE_CMD_NOTIFY_OTA_STARTED = 51;
const BLE_CMD_NOTIFY_OTA_PROGRESS = 52;
const BLE_CMD_NOTIFY_OTA_DONE = 53;
const BLE_CMD_NOTIFY_OTA_ERROR = 54;

// BLE custom command
const BLE_CMD_SEND_MESSAGE = 100;

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

terminal.receive = function (data) {
    addToChat(data, 'green')
}

terminal._log = log

terminal.onConnectionChanged = function (connected) {
    log('Connection changed to ' + connected)
    setBluetoothIcon(terminal.isConnected())
    if (connected) {
        sendCommand(BLE_CMD_GET_MTU);
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
            addToChat(message, 'blue')
            switch (message) {
                case 'get-mtu':
                    sendCommand(BLE_CMD_GET_MTU);
                    break;
                default:
                    sendCommand(BLE_CMD_SEND_MESSAGE, message, (percent) => {
                        console.log('Percent ' + percent + '%')
                    })
                    break;
            }

            chatInput.value = ''
        }
    }
})

