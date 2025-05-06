import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import Swal from 'sweetalert2';
import { db } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';

const SignUp = () => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    const initModelsAndVideo = async () => {
      try {
        setStatus('Loading models...');
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models/tiny_face_detector_model'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models/face_landmark_68_model'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models/face_recognition_model'),
        ]);

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        setStatus('Models loaded. Ready to register.');
      } catch (error) {
        setStatus('Failed to initialize camera or load models.');
        console.error(error);
      }
    };

    initModelsAndVideo();
  }, []);

  const captureSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !role) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Please fill in all the required fields.',
      });
      return;
    }

    setStatus('Scanning for face...');
    Swal.fire({
      title: 'Scanning...',
      text: 'Please wait while we detect your face...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Face detection timed out.')), 5000)
    );

    try {
      const detection = await Promise.race([
        faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor(),
        timeout,
      ]);

      if (!detection) {
        Swal.fire({
          icon: 'error',
          title: 'No Face Detected',
          text: 'Please ensure your face is visible and well-lit.',
        });
        return;
      }

      const descriptor = Array.from(detection.descriptor);
      const snapshot = captureSnapshot(); // Get base64 image

      await addDoc(collection(db, 'users'), {
        name,
        role,
        descriptor,
        image: snapshot,
      });

      Swal.fire({
        icon: 'success',
        title: 'User Registered',
        text: 'You have been successfully registered.',
      });

      setStatus('User registered successfully!');
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: 'error',
        title: 'Registration Failed',
        text: error.message || 'An error occurred while registering.',
      });
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">Face Recognition Sign Up</h1>

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="admin">Admin</option>
        </select>

        <div>
          <video ref={videoRef} autoPlay muted width="320" height="240" />
        </div>

        {/* Hidden canvas for snapshot */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Register
        </button>
      </form>

      <p className="mt-2 text-sm text-gray-600">{status}</p>
    </div>
  );
};

export default SignUp;
