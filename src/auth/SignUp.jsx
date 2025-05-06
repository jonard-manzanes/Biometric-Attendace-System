import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import Swal from 'sweetalert2';
import { db } from '../firebaseConfig';
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

const SignUp = () => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState('Initializing...');
  const role = 'student'; // Automatically set to student

  // Available courses and years
  const courses = [
    'Computer Science',
    'Information Technology',
    'Engineering',
    'Business Administration',
    'Psychology',
    'Nursing'
  ];

  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];

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

  const checkIfStudentExists = async (studentId) => {
    const q = query(collection(db, 'users'), where('studentId', '==', studentId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty ? null : querySnapshot.docs[0];
  };

  const checkIfFaceExists = async (descriptor) => {
    // Get all users with face descriptors
    const q = query(collection(db, 'users'), where('descriptor', '!=', null));
    const querySnapshot = await getDocs(q);
    
    // Compare the new descriptor with existing ones
    for (const doc of querySnapshot.docs) {
      const existingDescriptor = doc.data().descriptor;
      // Calculate Euclidean distance between descriptors
      const distance = faceapi.euclideanDistance(descriptor, existingDescriptor);
      // If distance is below threshold, it's likely the same face
      if (distance < 0.6) {
        return true;
      }
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!firstName.trim() || !lastName.trim() || !studentId.trim() || !course || !year) {
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
      
      // Check if this face already exists in the database
      const faceExists = await checkIfFaceExists(descriptor);
      if (faceExists) {
        Swal.fire({
          icon: 'error',
          title: 'Face Already Registered',
          text: 'This face has already been registered in our system. Please contact support if this is an error.',
        });
        return;
      }

      const snapshot = captureSnapshot(); // Get base64 image
      const existingStudentDoc = await checkIfStudentExists(studentId);

      if (existingStudentDoc) {
        const existingStudent = existingStudentDoc.data();
        
        if (existingStudent.descriptor && existingStudent.descriptor.length > 0) {
          // If the student has a face already registered, prevent signup
          Swal.fire({
            icon: 'error',
            title: 'Account Already Registered',
            text: 'This student ID is already registered with a face.',
          });
          return;
        } else {
          // If the student exists but doesn't have a face registered, update their face descriptor
          const userRef = doc(db, 'users', existingStudentDoc.id);
          await updateDoc(userRef, {
            descriptor,
            image: snapshot,
          });

          Swal.fire({
            icon: 'success',
            title: 'Face Registered Successfully',
            text: 'Your face has been successfully registered to your account.',
          });
        }
      } else {
        // New student registration
        await addDoc(collection(db, 'users'), {
          firstName,
          lastName,
          studentId,
          course,
          year,
          role, // Automatically set to 'student'
          descriptor,
          image: snapshot,
          fullName: `${firstName} ${lastName}`, // Updated to exclude middle initial
        });

        Swal.fire({
          icon: 'success',
          title: 'Registration Successful',
          text: 'You have been successfully registered as a student.',
        });
      }

      setStatus('Student registered successfully!');

      // Reset form
      setFirstName('');
      setLastName('');
      setStudentId('');
      setCourse('');
      setYear('');
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
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">Student Registration</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name*</label>
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="border p-2 rounded w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name*</label>
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="border p-2 rounded w-full"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Student ID*</label>
          <input
            type="text"
            placeholder="Student ID"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="border p-2 rounded w-full"
            required
          />
        </div>

        <div className='grid grid-cols-2 gap-3'>
          
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Course*</label>
          <select
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="border p-2 rounded w-full"
            required
          >
            <option value="">Select Course</option>
            {courses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year*</label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="border p-2 rounded w-full"
            required
          >
            <option value="">Select Year</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        </div>



      <div className="mt-4 text-center">
        <video ref={videoRef} width="100%" height="auto" autoPlay muted />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <p className="mt-4 text-center">{status}</p>


      <div className="mt-4">
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded"
          >
            Register
          </button>
        </div>
      </form>
    </div>
  );
};

export default SignUp;
