import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import Swal from 'sweetalert2';
import { db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

const Login = () => {
  const videoRef = useRef();
  const [status, setStatus] = useState('Initializing...');
  const [loading, setLoading] = useState(true);
  const [showRetry, setShowRetry] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const intervalRef = useRef(null);
  const matcherRef = useRef(null);
  const userMapRef = useRef({});

  const clearScanning = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsScanning(false);
  };

  const startScanning = () => {
    if (isScanning) return;
    
    setShowRetry(false);
    setStatus('Scanning face...');
    setIsScanning(true);

    intervalRef.current = setInterval(async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          const match = matcherRef.current.findBestMatch(detection.descriptor);
          console.log(`Match: ${match.label}, Distance: ${match.distance.toFixed(4)}`);
          setStatus(`Match: ${match.label}`);

          if (match.label !== 'unknown') {
            clearScanning();
            const role = userMapRef.current[match.label] || 'student';
            const userData = { name: match.label, role };
            localStorage.setItem('user', JSON.stringify(userData));

            Swal.fire({
              icon: 'success',
              title: `Welcome, ${match.label}`,
              text: `Role: ${role}`,
              timer: 2500,
              showConfirmButton: false,
              didClose: () => {
                window.location.href = `/${role}/dashboard`;
              },
            });
          } else {
            clearScanning();
            setShowRetry(true);
            setStatus('Face not recognized. Please try again.');
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            Swal.fire({
              icon: 'error',
              title: 'Face Not Recognized',
              text: 'No matching user found.',
            });
          }
        }
      } catch (err) {
        console.error('Scanning error:', err);
        clearScanning();
        setShowRetry(true);
        setStatus('Error during face detection');
      }
    }, 5000); // Increased interval to 5 seconds to reduce frequency
  };

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models/tiny_face_detector_model'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models/face_landmark_68_model'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models/face_recognition_model'),
        ]);

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;

        const snapshot = await getDocs(collection(db, 'users'));
        const labeledDescriptors = [];
        const userMap = {};

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (typeof data.name === 'string' && Array.isArray(data.descriptor)) {
            const descriptor = new Float32Array(data.descriptor);
            labeledDescriptors.push(
              new faceapi.LabeledFaceDescriptors(data.name, [descriptor])
            );
            userMap[data.name] = data.role || 'student';
          }
        });

        if (labeledDescriptors.length === 0) {
          setStatus('No registered users found.');
          setLoading(false);
          return;
        }

        matcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
        userMapRef.current = userMap;

        setLoading(false);
        startScanning();
      } catch (err) {
        console.error(err);
        setStatus('Error: Unable to start face recognition.');
        setLoading(false);

        Swal.fire({
          icon: 'error',
          title: 'Initialization Failed',
          text: 'Could not load models or camera.',
        });
      }
    };

    init();

    return () => {
      clearScanning();
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">Face Login</h1>
      <video ref={videoRef} autoPlay muted width="320" height="240" className="rounded shadow" />

      {loading ? (
        <p className="mt-2 text-gray-500">Loading models and camera...</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-gray-600">{status}</p>
          {showRetry && (
            <button
              onClick={startScanning}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
              disabled={isScanning}
            >
              {isScanning ? 'Scanning...' : 'Try Again'}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default Login;