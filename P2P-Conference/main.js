import "https://www.gstatic.com/firebasejs/10.7.2/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore-compat.js";
import { firebaseConfig } from './config.js';

// WebRTC configuration
const constraints = {
    'video': true,
    'audio': false
}
const configuration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302', }] }
let peerConnection;
let dataChannel;;
let localStream;
let remoteStream;

// Connection
let roomId;      // index.html?room=SOMETHING123
let uid = String(Math.floor(Math.random() * 10000000000000).toString());

// Firebase
const firebaseApp = firebase.initializeApp(firebaseConfig);
const database = firebase.firestore();


async function init() {
    peerConnection = new RTCPeerConnection(configuration);
    dataChannel = peerConnection.createDataChannel("myChannel");

    // Listen to firestore db for document changes
    database.collection("calls").doc(roomId)
        .onSnapshot((doc) => {
            if (doc.data() != undefined && doc.data().uid != uid) {
                if (doc.data().data.type == "offer") {
                    console.log("Creating SDP answer");
                    createSdpAnswer();
                } else {
                    console.log("Handling remote SDP answer");
                    handleRemoteSdpAnswer();
                }
            }
        });


    peerConnection.addEventListener('connectionstatechange', event => {
        if (peerConnection.connectionState === 'connected') {
            console.log("CONNECTED")
        }
    });


    peerConnection.addEventListener('datachannel', event => {
        dataChannel = event.channel;
        console.log("DATA CHANNEL RECEIVED")
    });

    dataChannel.addEventListener("open", (event) => {
        console.log("DATA CHANNEL OPEN")
    });

    dataChannel.addEventListener("close", (event) => {
        console.log("DATA CHANNEL CLOSED")
    });

    dataChannel.addEventListener("error", (event) => {
        console.log("DATA CHANNEL ERROR")
    });

    dataChannel.addEventListener('message', event => {
        createMessageBox(event.data, false);

        const messagesContainer = document.getElementById("messages-container");
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });




    // Local media
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    document.querySelector('video#localVideo').srcObject = localStream;

    // Remote media
    peerConnection.addEventListener('track', async (event) => {
        [remoteStream] = event.streams;
        document.querySelector('#remoteVideo').srcObject = remoteStream;
    });
}


// --- SDP messages ---

window.createSdpOffer = async function () {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    const iceCandidates = await waitForIceGatheringComplete();

    database.collection("calls").doc(roomId).set({
        uid: uid,
        data: offer,
        ice: iceCandidates
    });

    console.log("SDP offer and ICE sent to database");
}

async function createSdpAnswer() {
    let remoteOffer;

    // Read remote SDP offer
    let docRef = database.collection("calls").doc(roomId);
    await docRef.get().then((doc) => {
        if (doc.exists) {
            remoteOffer = doc.data().data.sdp;
        } else {
            console.log("No such document!");
        }
    }).catch((error) => {
        console.log("Error getting document:", error);
    });

    // Create SDP answer
    await peerConnection.setRemoteDescription({ type: 'offer', sdp: remoteOffer });
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    const iceCandidates = await waitForIceGatheringComplete();

    database.collection("calls").doc(roomId).set({
        uid: uid,
        data: answer,
        ice: iceCandidates
    });
    console.log("SDP answer and ICE sent to database");
}

async function handleRemoteSdpAnswer() {
    let remoteAnswer;
    let remoteIceCandidates;

    let docRef = database.collection("calls").doc(roomId);
    await docRef.get().then((doc) => {
        if (doc.exists) {
            remoteAnswer = doc.data().data.sdp;
            remoteIceCandidates = doc.data().ice.candidates;
        } else {
            console.log("No such document!");
        }
    }).catch((error) => {
        console.log("Error getting document:", error);
    });

    await peerConnection.setRemoteDescription({ type: 'answer', sdp: remoteAnswer });
    await handleRemoteIceCandidates(remoteIceCandidates);
    console.log('Remote answer acknowledged by local peer');
}


// --- Handle ICE candidates ---

function waitForIceGatheringComplete() {
    return new Promise(resolve => {
        var ice = {
            candidates: [{}]
        };

        const candidateHandler = event => {
            if (event.candidate) {
                ice.candidates.push({
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex
                });
                // console.log(ice.candidates)
            }
        };

        const stateChangeHandler = () => {
            if (peerConnection.iceGatheringState === "complete") {
                peerConnection.removeEventListener("icecandidate", candidateHandler);
                peerConnection.removeEventListener("icegatheringstatechange", stateChangeHandler);
                console.log("ICE gathering finished");
                resolve(ice);
            }
        };

        peerConnection.addEventListener("icecandidate", candidateHandler)
        peerConnection.addEventListener("icegatheringstatechange", stateChangeHandler);
    })
}

async function handleRemoteIceCandidates(remoteIceCandidates) {
    remoteIceCandidates.forEach(candidate => {
        // TODO: fix error on empty candidate: "TypeError: Either sdpMid or sdpMLineIndex must be specified"
        try {
            if (candidate.candidate != undefined) {
                // console.log(candidate);
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('ICE candidate added: ' + candidate.candidate);
            }
        } catch (e) {
            console.log(candidate);
            console.log('Error adding recieved ICE candidate', e);
        }
    });
}


// --- Chat message ---

window.sendMessage = function () {
    const message = document.getElementById("new-msg-input").value;

    // If it's nothing but whitespace then don't send
    if (/^\s*$/.test(message)) {
        return;
    }

    dataChannel.send(message);
    console.log("Message sent: ", message);
    createMessageBox(message, true);

    const messagesContainer = document.getElementById("messages-container");
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    document.getElementById("new-msg-input").value = "";
}

window.newMsgInputButtonPressed = function (event) {
    if (event.key === "Enter") {
        sendMessage();
    }
}

function createMessageBox(message, isLocal) {
    let msgContainerClass;
    if (isLocal) {
        msgContainerClass = "local-msg-container chat-message-container";
    } else {
        msgContainerClass = "received-msg-container chat-message-container";
    }

    let msgText = document.createElement("p");
    msgText.innerHTML = message;

    let msgContainer = document.createElement("div");
    msgContainer.className = msgContainerClass;
    msgContainer.appendChild(msgText);

    const chatBoardContainer = document.getElementById("messages-container");
    chatBoardContainer.appendChild(msgContainer);
}




roomId = "--12-"
init();