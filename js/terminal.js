const toggleConnectionBtn = document.getElementById('toggleConnectionBtn')
const chatInput = document.getElementById('chatInput')

const terminal = new BluetoothTerminal('Stair Led', '6e400001-b5a3-f393-e0a9-e50e24dcca9e')

function log(message, type = 'debug') {
    console.log(message)
    addToChat(message, type === 'error' ? 'red' : 'black')
}

terminal.receive = function (data) {
    addToChat(data, 'green')
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
            addToChat(message, 'blue')
            terminal.send(message).
                catch((error) => log(error, 'error'))

            chatInput.value = ''
        }
    }
})

