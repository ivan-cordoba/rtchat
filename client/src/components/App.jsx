import React from 'react';
import io from 'socket.io-client';

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.socket = io();
    this.isChannelReady = false;
    this.isInitiator = false;
    this.isStarted = false;
    this.localStream = null;
    this.pc = null;
    this.remoteStream = null;
    this.turnReady = null;
    this.localVideo = null;
    this.remoteVideo = null;
    this.constraints = {
      video: true,
    };
    this.pcConfig = {
      iceServers: [{
        urls: 'stun:stun.l.google.com:19302',
      }],
    };
    this.sdpConstraints = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    };
    this.room = 'foo';
    this.state = {
      input: '',
      start: false,
      call: true,
      hangup: true,
    };
    this.createPeerConnection = this.createPeerConnection.bind(this);
    this.handleIceCandidate = this.handleIceCandidate.bind(this);
    this.handleCreateOfferError = this.handleCreateOfferError.bind(this);
    this.doCall = this.doCall.bind(this);
    this.doAnswer = this.doAnswer.bind(this);
    this.setLocalAndSendMessage = this.setLocalAndSendMessage.bind(this);
    this.onCreateSessionDescriptionError = this.onCreateSessionDescriptionError.bind(this);
    this.requestTurn = this.requestTurn.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.gotStream = this.gotStream.bind(this);
    this.maybeStart = this.maybeStart.bind(this);
    this.handleRemoteStreamAdded = this.handleRemoteStreamAdded.bind(this);
    this.handleRemoteStreamRemoved = this.handleRemoteStreamRemoved.bind(this);
    this.hangup = this.hangup.bind(this);
    this.handleRemoteHangup = this.handleRemoteHangup.bind(this);
    this.stop = this.stop.bind(this);
  }

  componentDidMount() {
    this.localVideo = document.getElementById('local');
    this.remoteVideo = document.getElementById('remote');

    if (this.room !== '') {
      this.socket.emit('create or join', this.room);
      console.log('Attempted to create or  join room', this.room);
    }

    this.socket.on('created', (room) => {
      console.log(`Created room ${room}`);
      this.isInitiator = true;
    });

    this.socket.on('full', (room) => {
      console.log(`Room ${room} is full`);
    });

    this.socket.on('join', (room) => {
      console.log(`Another peer made a request to join room ${room}`);
      console.log(`This peer is the initiator of room ${room}!`);
      this.isChannelReady = true;
    });

    this.socket.on('joined', (room) => {
      console.log(`joined: ${room}`);
      this.isChannelReady = true;
    });

    this.socket.on('log', (array) => {
      console.log(...array);
    });

    this.socket.on('message', (message) => {
      console.log('Client received message:', message);
      if (message === 'got user media') {
        this.maybeStart();
      } else if (message.type === 'offer') {
        if (!this.isInitiator && !this.isStarted) {
          this.maybeStart();
        }
        this.pc.setRemoteDescription(new RTCSessionDescription(message));
        this.doAnswer();
      } else if (message.type === 'answer' && this.isStarted) {
        this.pc.setRemoteDescription(new RTCSessionDescription(message));
      } else if (message.type === 'candidate' && this.isStarted) {
        const candidate = new RTCIceCandidate({
          sdpMLineIndex: message.label,
          candidate: message.candidate,
        });
        this.pc.addIceCandidate(candidate);
      } else if (message === 'bye' && this.isStarted) {
        this.handleRemoteHangup();
      }
    });

    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    })
      .then(this.gotStream)
      .catch((e) => {
        alert(`getUserMedia() error: ${e.name}`);
      });

    console.log('Getting user media with constraints', this.constraints);

    if (window.location.hostname !== 'localhost') {
      this.requestTurn('https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913');
    }

    window.onbeforeunload = () => {
      this.sendMessage('bye');
    };
  }

  onCreateSessionDescriptionError(error) {
    console.log(`Failed to create session description: ${error.toString()}`);
  }

  setLocalAndSendMessage(sessionDescription) {
    this.pc.setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message', sessionDescription);
    this.sendMessage(sessionDescription);
  }

  doCall() {
    console.log('Sending offer to peer');
    this.pc.createOffer(this.setLocalAndSendMessage, this.handleCreateOfferError);
  }

  doAnswer() {
    console.log('Sending answer to peer.');
    this.pc.createAnswer()
      .then(this.setLocalAndSendMessage, this.onCreateSessionDescriptionError);
  }

  requestTurn(turnURL) {
    let turnExists = false;
    for (const i in this.pcConfig.iceServers) {
      if (this.pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
        turnExists = true;
        this.turnReady = true;
        break;
      }
    }
    if (!turnExists) {
      console.log('Getting TURN server from ', this.turnURL);
      // No TURN server. Get one from computeengineondemand.appspot.com:
      const xhr = new XMLHttpRequest();
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const turnServer = JSON.parse(xhr.responseText);
          console.log('Got TURN server: ', turnServer);
          this.pcConfig.iceServers.push({
            urls: `turn:${turnServer.username}@${turnServer.turn}`,
            credential: turnServer.password,
          });
          this.turnReady = true;
        }
      };
      xhr.open('GET', turnURL, true);
      xhr.send();
    }
  }

  sendMessage(message) {
    console.log('Client sending message: ', message);
    this.socket.emit('message', message);
  }

  gotStream(stream) {
    console.log('Adding local stream.', stream);
    this.localStream = stream;
    this.localVideo.srcObject = stream;
    this.sendMessage('got user media');
    if (this.isInitiator) {
      this.maybeStart();
    }
  }

  maybeStart() {
    console.log('>>>>>>> maybeStart() ', this.isStarted, this.localStream, this.isChannelReady);
    if (!this.isStarted && typeof this.localStream !== 'undefined' && this.isChannelReady) {
      console.log('>>>>>> creating peer connection');
      this.createPeerConnection();
      this.pc.addStream(this.localStream);
      this.isStarted = true;
      console.log('isInitiator', this.isInitiator);
      if (this.isInitiator) {
        this.doCall();
      }
    }
  }

  handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
    this.remoteStream = event.stream;
    this.remoteVideo.srcObject = this.remoteStream;
  }

  handleRemoteStreamRemoved(event) {
    console.log('Remote stream removed. Event: ', event);
  }

  hangup() {
    console.log('Hanging up.');
    this.stop();
    this.sendMessage('bye');
  }

  handleRemoteHangup() {
    console.log('Session terminated.');
    this.stop();
    this.isInitiator = false;
  }

  stop() {
    this.isStarted = false;
    this.pc.close();
    this.pc = null;
  }

  createPeerConnection() {
    try {
      this.pc = new RTCPeerConnection(null);
      this.pc.onicecandidate = this.handleIceCandidate;
      this.pc.onaddstream = this.handleRemoteStreamAdded;
      this.pc.onremovestream = this.handleRemoteStreamRemoved;
      console.log('Created RTCPeerConnnection');
    } catch (e) {
      console.log(`Failed to create PeerConnection, exception: ${e.message}`);
      alert('Cannot create RTCPeerConnection object.');
    }
  }

  handleIceCandidate(event) {
    console.log('icecandidate event: ', event);
    if (event.candidate) {
      this.sendMessage({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate,
      });
    } else {
      console.log('End of candidates.');
    }
  }

  handleCreateOfferError(event) {
    console.log('createOffer() error: ', event);
  }

  render() {
    return (
      <div>
        <input
          name="input"
          value={this.state.input}
          onChange={this.handleInputChange}
        />
        <button
          onClick={this.submitMessage}
        >
          Submit
        </button>
        <button
          onClick={this.startAction}
          disabled={this.state.start}
        >
          Start
        </button>
        <button
          onClick={this.callAction}
          disabled={this.state.call}
        >
          Call
        </button>
        <button
          onClick={this.hangupAction}
          disabled={this.state.hangup}
        >
          Hang Up
        </button>
        Local
        <video
          autoPlay
          playsInline
          id="local"
        />
        Remote
        <video
          autoPlay
          playsInline
          id="remote"
        />
      </div>
    );
  }
}
