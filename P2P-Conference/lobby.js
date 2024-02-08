window.createRoom = function() {
    const roomId = String(Math.floor(Math.random() * 1000000000).toString());
    window.location.href = `index.html?room=${roomId}`;
}

window.joinRoom = function() {
    const room = document.getElementById("join-room-input").value;

    var regex = /[^0-9]/;
    if (regex.test(room)) {
        alert("Invalid room ID");
        return;
    }

    // TODO: check if room exists
    
    // TODO: rename html files

    window.location.href = `index.html?room=${room}`;
}