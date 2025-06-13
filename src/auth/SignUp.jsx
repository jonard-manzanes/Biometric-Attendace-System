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
  serverTimestamp,
} from "firebase/firestore";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/xanjovqw"; // Replace with your Formspree endpoint

const sendSuccessEmail = async (email, firstName) => {
  try {
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        message: `Hello ${firstName}, your registration was successful!`,
      }),
    });
    if (!response.ok) throw new Error("Failed to send email");
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
};

const SignUp = () => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Initializing camera...");
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [currentDirection, setCurrentDirection] = useState("center");
  const directions = ["left", "right", "up", "down", "center"];
  const directionIndexRef = useRef(0);
  const role = "student";

  useEffect(() => {
    const initModelsAndVideo = async () => {
      try {
        setStatus("Loading face recognition models...");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(
            "/models/tiny_face_detector_model"
          ),
          faceapi.nets.faceLandmark68Net.loadFromUri(
            "/models/face_landmark_68_model"
          ),
          faceapi.nets.faceRecognitionNet.loadFromUri(
            "/models/face_recognition_model"
          ),
        ]);

        setStatus("Accessing camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        videoRef.current.srcObject = stream;
        setStatus("Ready for registration");
      } catch (error) {
        setStatus("Failed to initialize camera or load models.");
        console.error(error);
        Swal.fire({
          icon: "error",
          title: "Camera Access Required",
          text: "Please enable camera access to continue with face registration.",
          confirmButtonColor: "#10b981",
        });
      }
    };

    initModelsAndVideo();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const changeDirection = () => {
    directionIndexRef.current =
      (directionIndexRef.current + 1) % directions.length;
    setCurrentDirection(directions[directionIndexRef.current]);

    if (directionIndexRef.current === directions.length - 1) {
      setTimeout(() => {
        setCurrentDirection("center");
      }, 2000);
    }
  };

  const startFaceScan = () => {
    setIsScanning(true);
    setStatus("Please follow the head movement instructions");
    const interval = setInterval(changeDirection, 2000);

    return () => {
      clearInterval(interval);
      setIsScanning(false);
      setCurrentDirection("center");
    };
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg");
  };

  const checkIfStudentExists = async (studentId) => {
    const q = query(
      collection(db, "users"),
      where("studentId", "==", studentId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty ? null : querySnapshot.docs[0];
  };

  const checkIfFaceExists = async (descriptor) => {
    const q = query(collection(db, "users"), where("descriptor", "!=", null));
    const querySnapshot = await getDocs(q);

    for (const doc of querySnapshot.docs) {
      const existingDescriptor = doc.data().descriptor;
      const distance = faceapi.euclideanDistance(
        descriptor,
        existingDescriptor
      );
      if (distance < 0.3) {
        return true;
      }
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !studentId.trim() ||
      !email.trim()
    ) {
      Swal.fire({
        icon: "warning",
        title: "Missing Information",
        text: "Please fill in all the required fields.",
        confirmButtonColor: "#10b981",
      });
      setIsLoading(false);
      return;
    }

    // Test email sending before face registration (for debugging)
    try {
      const emailTest = await sendSuccessEmail(email, firstName);
      if (!emailTest) {
        throw new Error("Email service test failed");
      }
    } catch (error) {
      console.error("Email test failed:", error);
    }

    try {
      // First complete face registration
      const stopScanning = startFaceScan();
      setStatus("Detecting face...");

      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      stopScanning();

      if (!detection) {
        throw new Error(
          "No face detected. Please ensure your face is visible and well-lit."
        );
      }

      const descriptor = Array.from(detection.descriptor);
      const faceExists = await checkIfFaceExists(descriptor);
      if (faceExists) {
        throw new Error("This face has already been registered in our system.");
      }

      const snapshot = captureSnapshot();
      const existingStudentDoc = await checkIfStudentExists(studentId);

      if (existingStudentDoc) {
        const existingStudent = existingStudentDoc.data();
        if (existingStudent.descriptor?.length > 0) {
          throw new Error("This student ID is already registered with a face.");
        }

        await updateDoc(doc(db, "users", existingStudentDoc.id), {
          descriptor,
          image: snapshot,
          email,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "users"), {
          firstName,
          lastName,
          studentId,
          email,
          role,
          descriptor,
          image: snapshot,
          fullName: `${firstName} ${lastName}`,
          createdAt: serverTimestamp(),
        });
      }

      // Send confirmation email after successful registration
      const emailSent = await sendSuccessEmail(email, firstName);

      await Swal.fire({
        icon: "success",
        title: "Registration Complete",
        html: `
          <div>
            <p>Registration successful!</p>
            ${
              emailSent
                ? '<p class="text-green-500">Confirmation email sent to ' +
                  email +
                  "</p>"
                : '<p class="text-yellow-500">Registration complete but email could not be sent</p>'
            }
            <p class="text-sm mt-2">Student ID: ${studentId}</p>
          </div>
        `,
        confirmButtonColor: "#10b981",
      });

      // Reset form
      setFirstName("");
      setLastName("");
      setStudentId("");
      setEmail("");
      setStatus("Registration successful!");
    } catch (error) {
      console.error("Registration Error:", error);
      Swal.fire({
        icon: "error",
        title: "Registration Failed",
        html: `
          <div>
            <p>${error.message}</p>
            <p class="text-sm mt-2">Please try again or contact support</p>
          </div>
        `,
        confirmButtonColor: "#10b981",
      });
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTeacherInvite = () => {
    Swal.fire({
      title: "University Invite Code",
      html: `
        <div class="text-center">
          <p class="mb-4">Enter the invite code provided by your university</p>
          <input 
            type="text" 
            id="inviteCode" 
            class="swal2-input" 
            placeholder="Enter code"
          >
          <p class="text-xs text-gray-500 mt-2">Contact your administrator if you don't have a code</p>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Verify Code",
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#ef4444",
      preConfirm: () => {
        const codeInput = Swal.getPopup().querySelector("#inviteCode");
        if (!codeInput.value) {
          Swal.showValidationMessage("Please enter a code");
          return false;
        }
        return codeInput.value;
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        const codeNumber = Number(result.value);
        if (isNaN(codeNumber)) {
          Swal.showValidationMessage("Please enter a valid numeric code");
          return;
        }

        try {
          const uniCode = collection(db, "UniversityCode");
          const q = query(uniCode, where("InviteCode", "==", codeNumber));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
            throw new Error("Invalid code provided");
          }

          sessionStorage.setItem("teacher-invite", "granted");
          window.location.href = "/teacher-signup";
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Invalid Code",
            text: error.message,
            confirmButtonColor: "#10b981",
          });
        }
      }
    });
  };

  const getDirectionInstruction = () => {
    switch (currentDirection) {
      case "left":
        return "Please turn your head slowly to the left";
      case "right":
        return "Please turn your head slowly to the right";
      case "up":
        return "Please look up slowly";
      case "down":
        return "Please look down slowly";
      default:
        return "Please look straight at the camera";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-emerald-700 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-6xl bg-white/5 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Camera Preview */}
          <div className="bg-emerald-900/30 p-6 flex flex-col items-center justify-center">
            <div className="relative w-full max-w-xs aspect-square mb-6">
              <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full h-full rounded-xl object-cover border-4 border-emerald-400 shadow-lg"
              />
              <canvas ref={canvasRef} className="hidden" />

              {isScanning && currentDirection !== "center" && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-white text-xl font-bold bg-black/50 px-4 py-2 rounded-lg animate-pulse">
                    {currentDirection.toUpperCase()}
                  </div>
                </div>
              )}
            </div>

            <div className="text-center w-full">
              <p className="text-emerald-100 font-medium bg-emerald-800/50 rounded-lg py-2 px-4">
                {isScanning ? getDirectionInstruction() : status}
              </p>
              <p className="text-emerald-200 text-sm mt-3">
                {isScanning
                  ? "Follow the instructions for better face capture"
                  : "Position your face in the center of the frame"}
              </p>
            </div>
          </div>

          {/* Registration Form */}
          <div className="bg-white/5 p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white text-center mb-6">
              Student Registration
            </h1>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-emerald-100 mb-1">
                    First Name*
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-emerald-100 mb-1">
                    Last Name*
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-emerald-100 mb-1">
                  Student ID*
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-emerald-100 mb-1">Email*</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="bg-emerald-900/30 p-3 rounded-lg">
                <p className="text-emerald-100 text-sm font-medium">
                  Registration Process:
                </p>
                <ul className="text-emerald-200 text-xs list-disc list-inside mt-1">
                  <li>Enter your information</li>
                  <li>Complete face registration</li>
                  <li>Receive confirmation email</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                  isLoading
                    ? "bg-emerald-700 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500"
                } text-white flex items-center justify-center`}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Register Now"
                )}
              </button>

              <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-emerald-800/50">
                <a
                  href="/login"
                  className="text-emerald-300 hover:text-white text-sm mb-2 sm:mb-0"
                >
                  Already have an account? Login
                </a>
                <button
                  type="button"
                  onClick={handleTeacherInvite}
                  className="text-emerald-300 hover:text-white text-sm font-medium"
                >
                  Are you a teacher? Register here
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
