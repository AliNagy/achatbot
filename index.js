const speech = require('@google-cloud/speech');
const client = new speech.SpeechClient();

const fetch = require('node-fetch');

const app = require('express')()
const server = require('http').Server(app)
const io = require('socket.io')(server)

server.listen(80)

console.log('Server up!')

const streamBuffers = require('stream-buffers')

const encoding = 'LINEAR16';
const sampleRateHertz = 48000;
const languageCode = 'en-US';

const audio = {
    content: null
}

const config = {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
}

const request = {
    config: config,
    audio: audio
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/www/index.html')
})

io.on('connection', function (socket) {
    console.log('Connection made!')
    function getReply(text, textToSpeech = true) {
        fetch('http://localhost:5000', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: text
        }).then(response => response.text())
            .then((data) => {
                console.log(data)
                socket.emit('reply', data)
            }).catch(err => console.error(err))
    }

    const recognizeStream = client
        .streamingRecognize(request)
        .on('error', console.error)
        .on('data', (data) => {
            socket.emit('reply', { text: getReply(data.results[0].alternatives[0]), audio: null })
        });

    const audioStream = new streamBuffers.ReadableStreamBuffer({
        frequency: 10,
        chunkSize: 2048
    })

    socket.on('audio-start', function () {
        audioStream.pipe(recognizeStream)
    });

    socket.on('audio-stop', function () {
        audioStream.unpipe()
    })

    socket.on('audio', function (data) {
        audioStream.put(data)
    })

    socket.on('question', function (data) {
        getReply(data.text, data.textToSpeech)
    })
});



