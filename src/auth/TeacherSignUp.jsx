import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";
import { db } from "../firebaseConfig";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";

const TeacherSignUp = () => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("Initializing...");
  const role = "teacher";

  useEffect(() => {
    const initModelsAndVideo = async () => {
      try {
        setStatus("Loading models...");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models/tiny_face_detector_model"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models/face_landmark_68_model"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models/face_recognition_model"),
        ]);

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        setStatus("Models loaded. Ready to register.");
      } catch (error) {
        setStatus("Failed to initialize camera or load models.");
        console.error(error);
      }
    };

    initModelsAndVideo();
  }, []);

  const captureSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg");
  };

  const checkIfEmployeeExists = async (employeeId) => {
    const q = query(collection(db, "users"), where("studentId", "==", employeeId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty ? null : querySnapshot.docs[0];
  };

  const checkIfFaceExists = async (descriptor) => {
    const q = query(collection(db, "users"), where("descriptor", "!=", null));
    const querySnapshot = await getDocs(q);

    for (const doc of querySnapshot.docs) {
      const existingDescriptor = doc.data().descriptor;
      const distance = faceapi.euclideanDistance(descriptor, existingDescriptor);
      if (distance < 0.6) {
        return true;
      }
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !employeeId.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Missing Information",
        text: "Please fill in all the required fields.",
      });
      return;
    }

    setStatus("Scanning for face...");
    Swal.fire({
      title: "Scanning...",
      text: "Please wait while we detect your face...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Face detection timed out.")), 5000)
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
          icon: "error",
          title: "No Face Detected",
          text: "Please ensure your face is visible and well-lit.",
        });
        return;
      }

      const descriptor = Array.from(detection.descriptor);
      const faceExists = await checkIfFaceExists(descriptor);
      if (faceExists) {
        Swal.fire({
          icon: "error",
          title: "Face Already Registered",
          text: "This face has already been registered in our system.",
        });
        return;
      }

      const snapshot = captureSnapshot();
      const existingEmployeeDoc = await checkIfEmployeeExists(employeeId);

      if (existingEmployeeDoc) {
        const existingEmployee = existingEmployeeDoc.data();

        if (existingEmployee.descriptor && existingEmployee.descriptor.length > 0) {
          Swal.fire({
            icon: "error",
            title: "Account Already Registered",
            text: "This employee ID is already registered with a face.",
          });
          return;
        } else {
          const userRef = doc(db, "users", existingEmployeeDoc.id);
          await updateDoc(userRef, {
            descriptor,
            image: snapshot,
          });

          Swal.fire({
            icon: "success",
            title: "Face Registered Successfully",
            text: "Your face has been successfully registered to your account.",
          });
        }
      } else {
        await addDoc(collection(db, "users"), {
          firstName,
          lastName,
          studentId: employeeId,
          role,
          descriptor,
          image: snapshot,
          fullName: `${firstName} ${lastName}`,
        });

        Swal.fire({
          icon: "success",
          title: "Registration Successful",
          text: "You have been successfully registered as a teacher.",
        });
      }

      setStatus("Teacher registered successfully!");
      setFirstName("");
      setLastName("");
      setEmployeeId("");
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text: error.message || "An error occurred while registering.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-emerald-800 flex justify-center items-center px-4">
      <div className="w-full max-w-4xl bg-white/10 p-6 md:p-10 rounded-xl shadow-lg backdrop-blur-2xl">
        <h1 className="text-emerald-200 text-2xl md:text-3xl text-center mb-6 font-bold">
          Teacher Registration
        </h1>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col">
              <label className="text-white">First Name*</label>
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 px-4 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="text-white">Last Name*</label>
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 px-4 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
                required
              />
            </div>
          </div>

          <div className="flex flex-col mb-4">
            <label className="text-white">Employee ID*</label>
            <input
              type="text"
              placeholder="Employee ID"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-1 px-4 py-2 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
              required
            />
          </div>

          <div className="flex justify-center mb-4">
            <div className="relative w-48 h-48 md:w-64 md:h-64">
              <video
                className="w-full h-full rounded-full border-4 border-green-500 shadow-lg object-cover"
                ref={videoRef}
                autoPlay
                muted
              />
              <canvas
                className="absolute top-0 left-0 w-full h-full rounded-full"
                ref={canvasRef}
                style={{ display: "none" }}
              />
            </div>
          </div>

          <p className="text-center text-white mb-4">{status}</p>

          <div className="mt-3 py-3 text-center bg-emerald-300 rounded-md hover:bg-emerald-400 transition-colors duration-200">
            <button type="submit" className="text-black font-semibold">
              Register
            </button>
          </div>
          <div className="flex justify-between text-emerald-500 mt-2 text-sm">
            <a href="/login">Login</a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeacherSignUp;
