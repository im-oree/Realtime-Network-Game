/**
 * WebRTC Manager - P2P DataChannel for low-latency movement updates
 * Falls back to Socket.IO if WebRTC unavailable or connection fails
 */

class WebRTCManager {
  constructor(options = {}) {
    this.peers = {} // peerId -> { peerConnection, dataChannel }
    this.signalingServer = options.signalingServer || null
    this.socket = options.socket || null
    this.localId = options.localId || null
    this.onMovementUpdate = options.onMovementUpdate || (() => {})
    this.onPeerDisconnect = options.onPeerDisconnect || (() => {})
    this.enabled = options.enabled !== false
    this.iceServers = options.iceServers || [
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['stun:stun1.l.google.com:19302'] },
      { urls: ['stun:stun2.l.google.com:19302'] }
    ]
  }

  /**
   * Initiate P2P connection to another peer
   */
  async connectToPeer(remotePeerId, isInitiator = false) {
    if (!this.enabled || this.peers[remotePeerId]) return false

    try {
      const peerConnection = new RTCPeerConnection({
        iceServers: this.iceServers
      })

      const dataChannel = isInitiator 
        ? peerConnection.createDataChannel('movement', { ordered: true, maxRetransmits: 0 })
        : null

      let dcReady = false

      // Handle ICE candidates
      peerConnection.onicecandidate = event => {
        if (event.candidate && this.socket) {
          this.socket.emit('ice-candidate', {
            to: remotePeerId,
            candidate: event.candidate
          })
        }
      }

      // Handle incoming data channels (for non-initiators)
      peerConnection.ondatachannel = event => {
        this._setupDataChannel(remotePeerId, event.channel)
      }

      // Setup data channel for initiators
      if (isInitiator && dataChannel) {
        this._setupDataChannel(remotePeerId, dataChannel)
      }

      // Negotiation complete
      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
          this._closePeer(remotePeerId)
          this.onPeerDisconnect(remotePeerId)
        }
      }

      this.peers[remotePeerId] = { peerConnection, dataChannel }

      // Create and send offer if initiator
      if (isInitiator) {
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        if (this.socket) {
          this.socket.emit('webrtc-offer', {
            to: remotePeerId,
            offer: offer
          })
        }
      }

      return true
    } catch (err) {
      console.warn(`WebRTC connection to ${remotePeerId} failed:`, err)
      this._closePeer(remotePeerId)
      return false
    }
  }

  /**
   * Handle incoming WebRTC offer
   */
  async handleOffer(remotePeerId, offer) {
    if (!this.enabled) return

    try {
      let peer = this.peers[remotePeerId]
      if (!peer) {
        const peerConnection = new RTCPeerConnection({
          iceServers: this.iceServers
        })

        peerConnection.onicecandidate = event => {
          if (event.candidate && this.socket) {
            this.socket.emit('ice-candidate', {
              to: remotePeerId,
              candidate: event.candidate
            })
          }
        }

        peerConnection.ondatachannel = event => {
          this._setupDataChannel(remotePeerId, event.channel)
        }

        peerConnection.onconnectionstatechange = () => {
          if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
            this._closePeer(remotePeerId)
            this.onPeerDisconnect(remotePeerId)
          }
        }

        peer = { peerConnection, dataChannel: null }
        this.peers[remotePeerId] = peer
      }

      await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await peer.peerConnection.createAnswer()
      await peer.peerConnection.setLocalDescription(answer)

      if (this.socket) {
        this.socket.emit('webrtc-answer', {
          to: remotePeerId,
          answer: answer
        })
      }
    } catch (err) {
      console.warn(`WebRTC offer handling failed for ${remotePeerId}:`, err)
      this._closePeer(remotePeerId)
    }
  }

  /**
   * Handle incoming WebRTC answer
   */
  async handleAnswer(remotePeerId, answer) {
    if (!this.enabled) return

    try {
      const peer = this.peers[remotePeerId]
      if (peer) {
        await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
      }
    } catch (err) {
      console.warn(`WebRTC answer handling failed for ${remotePeerId}:`, err)
      this._closePeer(remotePeerId)
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  async handleIceCandidate(remotePeerId, candidate) {
    if (!this.enabled) return

    try {
      const peer = this.peers[remotePeerId]
      if (peer) {
        await peer.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      }
    } catch (err) {
      console.warn(`ICE candidate addition failed for ${remotePeerId}:`, err)
    }
  }

  /**
   * Send movement update via WebRTC or fallback to Socket.IO
   */
  sendMovement(peerId, data) {
    if (!this.enabled) return false

    const peer = this.peers[peerId]
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      try {
        // WebRTC message format: compact binary to minimize latency
        const msg = JSON.stringify({
          t: 'm', // type: movement
          seq: data.seq,
          vx: data.vx,
          vy: data.vy,
          j: data.jump ? 1 : 0,
          jp: data.jetpack ? 1 : 0,
          ts: Date.now()
        })
        peer.dataChannel.send(msg)
        return true
      } catch (err) {
        console.warn(`WebRTC send failed for ${peerId}:`, err)
        return false
      }
    }
    return false
  }

  /**
   * Broadcast movement to all connected peers
   */
  broadcastMovement(data) {
    let count = 0
    for (const peerId in this.peers) {
      const peer = this.peers[peerId]
      if (peer?.dataChannel?.readyState === 'open') {
        try {
          const msg = JSON.stringify({
            t: 'm',
            seq: data.seq,
            vx: data.vx,
            vy: data.vy,
            j: data.jump ? 1 : 0,
            jp: data.jetpack ? 1 : 0,
            ts: Date.now()
          })
          peer.dataChannel.send(msg)
          count++
        } catch (err) {
          console.warn(`WebRTC broadcast failed for ${peerId}:`, err)
        }
      }
    }
    return count
  }

  /**
   * Setup data channel handlers
   */
  _setupDataChannel(peerId, dataChannel) {
    dataChannel.onopen = () => {
      console.log(`WebRTC channel open with ${peerId}`)
    }

    dataChannel.onmessage = event => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.t === 'm') {
          // Movement update
          this.onMovementUpdate({
            peerId,
            seq: msg.seq,
            vx: msg.vx,
            vy: msg.vy,
            jump: msg.j === 1,
            jetpack: msg.jp === 1,
            latency: Date.now() - msg.ts
          })
        }
      } catch (err) {
        console.warn(`WebRTC message parse failed:`, err)
      }
    }

    dataChannel.onerror = err => {
      console.warn(`WebRTC data channel error with ${peerId}:`, err)
      this._closePeer(peerId)
    }

    dataChannel.onclose = () => {
      console.log(`WebRTC channel closed with ${peerId}`)
      this._closePeer(peerId)
    }

    if (this.peers[peerId]) {
      this.peers[peerId].dataChannel = dataChannel
    }
  }

  /**
   * Close peer connection
   */
  _closePeer(peerId) {
    const peer = this.peers[peerId]
    if (peer) {
      try {
        peer.dataChannel?.close()
        peer.peerConnection?.close()
      } catch (err) {
        console.warn(`Error closing peer ${peerId}:`, err)
      }
      delete this.peers[peerId]
    }
  }

  /**
   * Cleanup all connections
   */
  disconnect() {
    for (const peerId in this.peers) {
      this._closePeer(peerId)
    }
    this.peers = {}
  }

  /**
   * Get connection stats for debugging
   */
  getStats() {
    const stats = {}
    for (const peerId in this.peers) {
      const peer = this.peers[peerId]
      stats[peerId] = {
        connection: peer.peerConnection?.connectionState,
        dataChannelReady: peer.dataChannel?.readyState === 'open'
      }
    }
    return stats
  }
}

export default WebRTCManager
