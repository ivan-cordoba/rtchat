import React from 'react';
import io from 'socket.io-client';

const handleLocalMediaStreamError = (error) => {
  console.log('navigator.getUserMedia error: ', error);
};

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.socket = io();
    this.isChannelReady = false;
    this.isInitiator = false;
    this.isStarted = false;
    this.pc = null;
    this.turnReady = null;
    this.startTime = null;
    this.localVideo = null;
    this.remoteVideo = null;
    this.localStream = null;
    this.remoteStream = null;
    this.localPeerConnection = null;
    this.remotePeerConnection = null;
    this.mediaStreamConstraints = {
      video: true,
    };
    this.offerOptions = {
      offerToReceiveVideo: 1,
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
    this.sendMessage = this.sendMessage.bind(this);
    this.gotStream = this.gotStream.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.submitMessage = this.submitMessage.bind(this);
    this.gotLocalMediaStream = this.gotLocalMediaStream.bind(this);
    this.getOtherPeer = this.getOtherPeer.bind(this);
    this.getPeerName = this.getPeerName.bind(this);
    this.gotRemoteMediaStream = this.gotRemoteMediaStream.bind(this);
    this.handleConnection = this.handleConnection.bind(this);
    this.createdAnswer = this.createdAnswer.bind(this);
    this.createdOffer = this.createdOffer.bind(this);
    this.startAction = this.startAction.bind(this);
    this.callAction = this.callAction.bind(this);
    this.hangupAction = this.hangupAction.bind(this);
    this.maybeStart = this.maybeStart.bind(this);
    this.state = {
      input: '',
      start: false,
      call: true,
      hangup: true,
    };
  }

  componentDidMount() {
    this.localVideo = document.getElementById('local');
    this.remoteVideo = document.getElementById('remote');
    if (window.room !== '') {
      console.log('Message from client: Asking to join room ' + room);
      this.socket.emit('create or join', window.room);
    }
    this.socket.on('created', (room, clientId) => {
      this.isInitiator = true;
    });
    this.socket.on('full', (room) => {
      console.log(`Message from client: Room ${room} is full :^(`);
    });

    this.socket.on('ipaddr', (ipaddr) => {
      console.log(`Message from client: Server IP address is ${ipaddr}`);
    });

    this.socket.on('joined', (room, clientId) => {
      console.log('joined: ' + room);
      this.isChannelReady = true;
    });

    this.socket.on('log', (array) => {
      console.log.apply(console, array);
    });

    this.socket.on('message', (msg) => {
      console.log('Client received message: ', msg);
      if (msg === 'got user media') {
        this.maybeStart();
      } else if (msg.type === 'offer') {
        if (!this.isInitiator && !this.isStarted) {
          this.maybeStart();
        }
        this.pc.setRemoteDescription(new RTCSessionDescription(msg));
        this.doAnswer();
      } else if (msg.type === 'answer' && this.isStarted) {
        this.pc.setRemoteDescription(new RTCSessionDescription(msg));
      } else if (msg.type === 'candidate' && this.isStarted) {
        const candidate = new RTCIceCandidate({
          sdpMLineIndex: msg.label,
          candidate: msg.candidate
        });
        this.pc.addIceCandidate(candidate);
      } else if (msg === 'bye' && this.isStarted) {
        this.handleRemoteHangup();
      }
    });

    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    })
      .then(this.gotStream);

    if (window.location.hostname !== 'localhost') {
      this.requestTurn('https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913');
    }

    window.onbeforeunload = () => {
      this.sendMessage('bye');
    };
  }

  getOtherPeer(peerConnection) {
    return (peerConnection === this.localPeerConnection) ?
      this.remotePeerConnection : this.localPeerConnection;
  }

  getPeerName(peerConnection) {
    return (peerConnection === this.localPeerConnection) ?
      'localPeerConnection' : 'remotePeerConnection';
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

  gotStream(stream) {
    console.log('Adding local stream.');
    this.localStream = stream;
    this.localVideo.srcObject = stream;
    this.sendMessage('got user media');
    if (this.isInitiator) {
      this.maybeStart();
    }
  }

  sendMessage(msg) {
    console.log('Client sending message: ', msg);
    this.socket.emit('message', msg);
  }

  gotLocalMediaStream(mediaStream) {
    this.localVideo.srcObject = mediaStream;
    this.localStream = mediaStream;
    this.setState({
      call: false,
    });
  }

  gotRemoteMediaStream(event) {
    const mediaStream = event.stream;
    this.remoteStream = mediaStream;
    this.remoteVideo.srcObject = mediaStream;
  }

  handleConnection(event) {
    const peerConnection = event.target;
    const iceCAndidate = event.candidate;
    if (iceCAndidate) {
      const newIceCandidate = new RTCIceCandidate(iceCAndidate);
      const otherPeer = this.getOtherPeer(peerConnection);

      otherPeer.addIceCandidate(newIceCandidate);
    }
  }

  createdAnswer(description) {
    this.remotePeerConnection.setLocalDescription(description);
    this.localPeerConnection.setRemoteDescription(description);
  }

  createdOffer(description) {
    this.localPeerConnection.setLocalDescription(description);
    this.remotePeerConnection.setRemoteDescription(description);
    this.remotePeerConnection.createAnswer()
      .then(this.createdAnswer);
  }

  startAction() {
    this.setState({
      start: true,
    });
    navigator.mediaDevices.getUserMedia(this.mediaStreamConstraints)
      .then(this.gotLocalMediaStream).catch(handleLocalMediaStreamError);
  }

  callAction() {
    this.setState({
      call: true,
      hangup: false,
    });
    this.startTime = window.performance.now();

    const servers = null;

    this.localPeerConnection = new RTCPeerConnection(servers);
    this.localPeerConnection.addEventListener('icecandidate', this.handleConnection);

    this.remotePeerConnection = new RTCPeerConnection(servers);
    this.remotePeerConnection.addEventListener('icecandidate', this.handleConnection);
    this.remotePeerConnection.addEventListener('addstream', this.gotRemoteMediaStream);

    this.localPeerConnection.addStream(this.localStream);

    this.localPeerConnection.createOffer(this.offerOptions)
      .then(this.createdOffer);
  }

  hangupAction() {
    this.localPeerConnection.close();
    this.remotePeerConnection.close();
    this.localPeerConnection = null;
    this.remotePeerConnection = null;
    this.setState({
      hangup: true,
      call: false,
    });
  }

  handleInputChange(e) {
    const { name, value } = e.target;
    this.setState({
      [name]: value,
    });
  }

  submitMessage() {
    this.socket.emit('message', this.state.input);
    this.setState({
      input: '',
    });
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
