const speech = require('@google-cloud/speech');
const client = new speech.SpeechClient();

const fetch = require('node-fetch');

const app = require('express')()
const server = require('http').Server(app)
const io = require('socket.io')(server)

var port = process.env.PORT || 3000;

server.listen(port)

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
    function getReply(text, textToSpeech = false) {
        fetch('http://localhost:5000', {
            method: 'POST',
            body: text
        }).then(response => response.text())
            .then((data) => {
                socket.emit('reply', data)
                if (textToSpeech) {
                    fetch('http://localhost:5000/tts', {
                        method: 'POST',
                        body: data
                    }).then(response => response.arrayBuffer()).then((data) => {
                        socket.emit('reply-tts', data)
                    })
                }
            }).catch(err => console.error(err))
    }

    async function getSTT(data) {
        const [response] = await client.recognize({
            audio: { content: data.toString('base64') },
            config: config
        })
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');
        socket.emit('speechToText', transcription)
    }

    const recognizeStream = client
        .streamingRecognize(request)
        .on('error', console.error)
        .on('data', (data) => {
            socket.emit('speechToText', data.results[0].alternatives[0].transcript)
        });

    const audioStream = new streamBuffers.ReadableStreamBuffer({
        frequency: 10,
        chunkSize: 1024
    })

    socket.on('audio-start', function () {
        audioStream.pipe(recognizeStream)
    });

    socket.on('audio-stop', function () {
        audioStream.unpipe()
    })

    socket.on('audio-stream', function (data) {
        audioStream.put(data)
    })

    socket.on('audio', function (data) {
        getSTT(data)
    })

    socket.on('question', function (data) {
        getReply(data.text, data.textToSpeech)
    })
});



