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
import emailjs from "@emailjs/browser";
import { v4 as uuidv4 } from "uuid";

// Initialize EmailJS with your Public Key
emailjs.init("iZA0kY1GD5ZucGLE8");

const SignUp = () => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    studentId: "",
    email: "",
    course: "",
    department: "",
  });
  const [status, setStatus] = useState("Initializing camera...");
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [currentDirection, setCurrentDirection] = useState("center");
  const directions = ["left", "right", "up", "down", "center"];
  const directionIndexRef = useRef(0);
  const role = "student";

  const courses = [
    "Computer Science",
    "Electrical Engineering",
    "Mechanical Engineering",
  ];
  const departments = ["Engineering", "Science", "Business"];

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

  // Validate email to only accept @evsu.edu.ph addresses
  const validateEmail = (email) => {
    const re = /^[^\s@]+@evsu\.edu\.ph$/;
    return re.test(email);
  };

  const changeDirection = () => {
    directionIndexRef.current =
      (directionIndexRef.current + 1) % directions.length;
    setCurrentDirection(directions[directionIndexRef.current]);

    if (directionIndexRef.current === directions.length - 1) {
      setTimeout(() => setCurrentDirection("center"), 2000);
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

  const generateVerificationToken = () => uuidv4();

  const sendVerificationEmail = async (email, firstName, userId) => {
    try {
      const verificationToken = generateVerificationToken();
      const verificationDoc = {
        userId,
        token: verificationToken,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      };
      await addDoc(collection(db, "verificationTokens"), verificationDoc);

      const verificationLink = `${window.location.origin}/verify-email?token=${verificationToken}&userId=${userId}`;

      const response = await emailjs.send(
        "service_h073o6m",
        "template_hoohcer",
        {
          link: verificationLink,
          email: email,
          websiteUrl: "https://biometric-attendace-system.vercel.app/",
          companyName: "University Attendance System",
        }
      );

      console.log("Email sent successfully:", response);
      return true;
    } catch (error) {
      console.error("Failed to send verification email:", {
        code: error.code,
        message: error.message,
        text: error.text,
      });
      return false;
    }
  };

  const captureSnapshot = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
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
      const distance = faceapi.euclideanDistance(
        descriptor,
        doc.data().descriptor
      );
      if (distance < 0.3) return true;
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Validate email format before proceeding
    if (!validateEmail(formData.email)) {
      Swal.fire({
        icon: "error",
        title: "Invalid Email",
        text: "Please use your official EVSU email address (ending with @evsu.edu.ph)",
        confirmButtonColor: "#10b981",
      });
      setIsLoading(false);
      return;
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

      if (!detection)
        throw new Error(
          "No face detected. Please ensure your face is visible and well-lit."
        );

      const descriptor = Array.from(detection.descriptor);
      if (await checkIfFaceExists(descriptor)) {
        throw new Error("This face has already been registered in our system.");
      }

      const snapshot = captureSnapshot();
      const existingStudentDoc = await checkIfStudentExists(formData.studentId);
      let userId;

      if (existingStudentDoc) {
        if (existingStudentDoc.data().descriptor?.length > 0) {
          throw new Error("This student ID is already registered with a face.");
        }
        userId = existingStudentDoc.id;
        await updateDoc(doc(db, "users", userId), {
          descriptor,
          image: snapshot,
          ...formData,
          verified: false,
          updatedAt: serverTimestamp(),
        });
      } else {
        const newUserRef = await addDoc(collection(db, "users"), {
          ...formData,
          role,
          descriptor,
          image: snapshot,
          verified: false,
          fullName: `${formData.firstName} ${formData.lastName}`,
          createdAt: serverTimestamp(),
        });
        userId = newUserRef.id;
      }

      // Send verification email with all required parameters
      const emailSent = await sendVerificationEmail(
        formData.email,
        formData.firstName,
        userId
      );

      await Swal.fire({
        icon: "success",
        title: "Verify Your Account",
        html: `
          <div class="text-left">
            <p class="mb-4">We've sent a verification link to:</p>
            <p class="font-medium text-emerald-600">${formData.email}</p>
            <div class="mt-4 p-3 bg-gray-100 rounded text-sm">
              <p>• Check your inbox for an email from University Attendance System</p>
              <p>• Click the verification link in the email</p>
              <p>• The link expires in 24 hours</p>
              ${!emailSent && `<p class="text-red-500 mt-2">Email not sent! Please contact support.</p>`}
            </div>
          </div>
        `,
        confirmButtonColor: "#10b981",
      });

      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        studentId: "",
        email: "",
        course: "",
        department: "",
      });
      setStatus("Registration successful! Please verify your email.");
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
        const codeInput = Swal.getPopup().querySelector('#inviteCode');
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-emerald-700 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-white/5 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Camera Preview Section */}
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
                  : "Position your face in the center"}
              </p>
            </div>
          </div>

          {/* Registration Form Section */}
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
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-emerald-100 mb-1">
                    Last Name*
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-emerald-100 mb-1">Email*</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white/10 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                  placeholder="username@evsu.edu.ph"
                />
                <p className="text-emerald-300 text-xs mt-1">Only @evsu.edu.ph emails are accepted</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-emerald-100 mb-1">Course*</label>
                  <select
                    name="course"
                    value={formData.course}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-emerald-900/80 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                    required
                  >
                    <option value="" className="bg-emerald-900">
                      Select Course
                    </option>
                    {courses.map((c) => (
                      <option key={c} value={c} className="bg-emerald-900">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-emerald-100 mb-1">
                    Department*
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-emerald-900/80 border border-emerald-400/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                    required
                  >
                    <option value="" className="bg-emerald-900">
                      Select Department
                    </option>
                    {departments.map((d) => (
                      <option key={d} value={d} className="bg-emerald-900">
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
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