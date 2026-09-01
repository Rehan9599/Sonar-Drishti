// Opens ws://<api-host>/ws/jobs/<job_id>/ and forwards "detection.partial" /
// "detection.complete" events to whatever subscribed via useDetectionSocket.js.
// This is the client side of the real-time streaming loop discussed in the architecture doc.
