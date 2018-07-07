import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';

window.room = prompt('Enter room name:');
ReactDOM.render(<App />, document.getElementById('App'));
