const constraints = {
    'video': true,
    'audio': false
}

const configuration = {
    'iceServers': [
        { 'urls': 'stun:stun.l.google.com:19302', }
    ]
}

let peerConnection;
let localStream;
let remoteStream;


async function init(constraints) {
    peerConnection = new RTCPeerConnection(configuration);

    // Listen for local ICE candidates
    peerConnection.addEventListener('icecandidate', event => {
        if (event.candidate) {
            document.getElementById('iceCandidates').value +=
                event.candidate.candidate + '\t' +
                event.candidate.sdpMid + '\t' +
                event.candidate.sdpMLineIndex + '\n';
        }
    });

    peerConnection.addEventListener('icegatheringstatechange', event => {
        if (peerConnection.iceGatheringState == 'complete') {
            console.log('ICE gathering finished')
        }
    });

    peerConnection.addEventListener('connectionstatechange', event => {
        console.log(peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
            console.log('PEERS CONNECTED!')
        }
    });

    peerConnection.addEventListener('track', async (event) => {
        [remoteStream] = event.streams;
        document.querySelector('#remoteVideo').srcObject = remoteStream;
    });



    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    document.querySelector('video#localVideo').srcObject = localStream;
}

async function createSdpOffer() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    navigator.clipboard.writeText(offer.sdp);
    console.log('SDP offer copied to clipboard')
}

async function createSdpAnswer() {
    const offer = document.getElementById('remoteOffer').value;

    await peerConnection.setRemoteDescription({ type: 'offer', sdp: offer });
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    navigator.clipboard.writeText(answer.sdp);
    console.log('SDP answer copied to clipboard');
}

async function handleRemoteSdpAnswer() {
    const answer = document.getElementById('remoteAnswer').value;
    await peerConnection.setRemoteDescription({ type: 'answer', sdp: answer });

    console.log('Remote answer acknowledged by local peer');
}

async function handleRemoteIceCandidates() {
    const remoteIceCandidatesText = document.getElementById('remoteIceCandidates').value;
    const remoteIceCandidatesList = remoteIceCandidatesText.split('\n').filter(candidate => candidate.trim() !== '');

    remoteIceCandidatesList.forEach(candidateLine => {
        let iceCandidateParameters = candidateLine.split('\t');
        let iceCandidateObject = {
            'candidate': iceCandidateParameters[0],
            'sdpMid': iceCandidateParameters[1],
            'sdpMLineIndex': iceCandidateParameters[2]
        };

        try {
            peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidateObject));
            console.log('ICE candidate added: ' + iceCandidateObject.candidate);
        } catch (e) {
            console.log('Error adding recieved ICE candidate', e);
        }
    });
}



init(constraints);