import "https://www.gstatic.com/firebasejs/10.7.2/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore-compat.js";
import { firebaseConfig } from './config.js';

firebase.initializeApp(firebaseConfig);
const database = firebase.firestore();

window.createRoom = function() {
    const roomId = String(Math.floor(Math.random() * 1000000).toString());
    window.location.href = `room.html?room=${roomId}`;
}

window.joinRoom = function() {
    const room = document.getElementById("join-room-input").value;

    // If room ID contains anything but numbers, then they're invalid
    var regex = /[^0-9]/;
    if (regex.test(room)) {
        alert("Invalid room ID");
        return;
    }

    // Check if room exists
    var docRef = database.collection("calls").doc(room);
    docRef.get().then((doc) => {
        if (doc.exists) {
            window.location.href = `room.html?room=${room}`;
        } else {
            alert("Room doesn't exist");
            return;
        }
    }).catch((error) => {
        console.log("Error getting document:", error);
    });
}