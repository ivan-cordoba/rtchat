import React from 'react';
import io from 'socket.io-client';

const handleLocalMediaStreamError = (error) => {
  console.log('navigator.getUserMedia error: ', error);
};

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.socket = io();
    this.handleInputChange = this.handleInputChange.bind(this);
    this.submitMessage = this.submitMessage.bind(this);
    this.gotLocalMediaStream = this.gotLocalMediaStream.bind(this);
    this.mediaStreamConstraints = {
      video: true,
    };
    this.localVideo = null;
    this.localStream = null;
    this.state = {
      input: '',
    };
  }

  componentDidMount() {
    this.localVideo = document.getElementById('stream');
    navigator.mediaDevices.getUserMedia(this.mediaStreamConstraints)
      .then(this.gotLocalMediaStream).catch(handleLocalMediaStreamError);
  }

  gotLocalMediaStream(mediaStream) {
    this.localStream = mediaStream;
    this.localVideo.srcObject = mediaStream;
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
        <video
          autoPlay
          playsinline
          id="stream"
        />
      </div>
    );
  }
}
