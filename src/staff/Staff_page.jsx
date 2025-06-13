import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

const StaffPage = () => {
  const [classesToday, setClassesToday] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [timeError, setTimeError] = useState(null);
  const navigate = useNavigate();

  // Function to convert time string (e.g. "1:20 PM") to minutes since midnight
  const timeToMinutes = (timeStr) => {
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let total = hours * 60 + minutes;
    if (period === 'PM' && hours !== 12) total += 12 * 60;
    if (period === 'AM' && hours === 12) total -= 12 * 60;
    return total;
  };

  // Function to check if current time is within class time
  const isWithinClassTime = (startTime, endTime) => {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotal = currentHours * 60 + currentMinutes;
    
    const startTotal = timeToMinutes(startTime);
    const endTotal = timeToMinutes(endTime);
    
    // Allow verification from 1 minute after start to 1 minute before end
    return currentTotal >= (startTotal + 1) && currentTotal <= (endTotal - 1);
  };

  const handleLogout = () => {
    Swal.fire({
      title: 'Are you sure?',
      text: "You will be logged out of the system",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, logout!',
      cancelButtonText: 'Cancel',
      background: '#ffffff',
      backdrop: `
        rgba(0,0,0,0.4)
      `
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem("user");
        localStorage.removeItem("userDocId");
        localStorage.removeItem("currentUserId");
        localStorage.removeItem("studentId");
        navigate("/login");
        
        Swal.fire({
          title: 'Logged Out!',
          text: 'You have been successfully logged out.',
          icon: 'success',
          confirmButtonColor: '#3085d6',
          background: '#ffffff'
        });
      }
    });
  };

  useEffect(() => {
    const fetchClassesToday = async () => {
      const today = new Date().toLocaleString("en-US", { weekday: "long" });
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const snapshot = await getDocs(collection(db, "classes"));
      const allClasses = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const classesWithTeacher = await Promise.all(
        allClasses.map(async (cls) => {
          const todaySchedule = cls.schedule?.find((s) => s.day === today);
          if (!todaySchedule) return null;

          let teacherName = "Unknown Teacher";
          if (cls.teacherID) {
            try {
              const teacherDoc = await getDoc(doc(db, "users", cls.teacherID));
              if (teacherDoc.exists()) {
                const t = teacherDoc.data();
                teacherName =
                  `${t.firstName || ""} ${t.lastName || ""}`.trim() ||
                  "Unnamed Teacher";
              }
            } catch {
              teacherName = "Unknown Teacher";
            }
          }

          // Find verification for today's date or day
          const todayVerification = cls.verifications?.find(
            v => v.date === currentDate || v.day === today
          );

          return {
            id: cls.id,
            subjectName: cls.subjectName,
            schedule: todaySchedule,
            joinCode: cls.joinCode,
            teacherName,
            verification: todayVerification || null,
          };
        })
      );

      setClassesToday(classesWithTeacher.filter(Boolean));
    };
    fetchClassesToday();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadImageToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "ux9m4odg");
    formData.append("cloud_name", "dzufxspg4");

    try {
      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dzufxspg4/image/upload",
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  const verifyClass = async () => {
    if (!image || !selectedClass) return;

    // Check if current time is within class time
    const { start, end } = selectedClass.schedule;
    if (!isWithinClassTime(start, end)) {
      setTimeError(`You can only verify this class between ${start} and ${end}`);
      return;
    }

    setUploading(true);
    try {
      const imageUrl = await uploadImageToCloudinary(image);
      const today = new Date().toLocaleString("en-US", { weekday: "long" });
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      if (imageUrl) {
        const classRef = doc(db, "classes", selectedClass.id);
        const classDoc = await getDoc(classRef);
        const existingData = classDoc.data();
        
        // Create or update verifications array
        const verifications = existingData.verifications || [];
        
        // Remove existing verification for today if it exists
        const updatedVerifications = verifications.filter(
          v => v.date !== currentDate && v.day !== today
        );
        
        // Add new verification
        updatedVerifications.push({
          day: today,
          date: currentDate,
          verified: true,
          verifiedAt: new Date().toISOString(),
          imageUrl,
          schedule: selectedClass.schedule // Store which schedule this applies to
        });

        await updateDoc(classRef, {
          verifications: updatedVerifications
        });

        // Update local state
        setClassesToday(classesToday.map(cls => 
          cls.id === selectedClass.id 
            ? { 
                ...cls, 
                verification: updatedVerifications.find(v => v.date === currentDate) 
              }
            : cls
        ));
      }
    } catch (error) {
      console.error("Error verifying class:", error);
    } finally {
      setUploading(false);
      setSelectedClass(null);
      setImage(null);
      setImagePreview(null);
      setTimeError(null);
    }
  };

  const todayDate = new Date().toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    weekday: "long",
  });

  const currentTime = new Date().toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const ClassCard = ({ cls }) => {
    const canVerify = !cls.verification && isWithinClassTime(cls.schedule.start, cls.schedule.end);
    
    return (
      <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden border border-emerald-100 flex flex-col h-full">
        <div className="p-5 flex-grow">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-bold text-emerald-900 line-clamp-2">{cls.subjectName}</h3>
            
            {cls.verification ? (
              <div className="flex-shrink-0 ml-2">
                <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Verified
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center text-emerald-600">
              <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">{cls.schedule.start} - {cls.schedule.end}</span>
            </div>
            
            <div className="flex items-center text-emerald-600">
              <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm">{cls.teacherName}</span>
            </div>
            
            {cls.joinCode && (
              <div className="flex items-center text-emerald-500">
                <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="text-xs font-mono">Code: {cls.joinCode}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 bg-emerald-50 border-t border-emerald-100">
          {cls.verification ? (
            cls.verification.imageUrl && (
              <a 
                href={cls.verification.imageUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center px-3 py-2 bg-white text-emerald-600 hover:text-emerald-800 text-sm font-medium rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                View Proof
              </a>
            )
          ) : (
            <button 
              onClick={() => setSelectedClass(cls)}
              disabled={!canVerify}
              className={`w-full flex items-center justify-center px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg ${
                canVerify 
                  ? "bg-emerald-600 hover:bg-emerald-700" 
                  : "bg-gray-400 cursor-not-allowed"
              }`}
              title={!canVerify ? `You can only verify this class between ${cls.schedule.start} and ${cls.schedule.end}` : ""}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {canVerify ? "Verify Class" : "Not Available"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100">
      <div className="container mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-emerald-900 mb-2">Today's Classes</h1>
              <div className="text-emerald-600">
                <p className="text-lg font-medium">{todayDate}</p>
                <p className="text-sm opacity-75">Current time: {currentTime}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors duration-200 shadow-md"
            >
              Logout
            </button>
          </div>
        </div>
        
        {/* Verification Modal */}
        {selectedClass && (
          <div className="fixed inset-0 bg-white bg-opacity-20 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl border-2 border-green-500">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-emerald-900 mb-2">
                  Verify Class
                </h2>
                <p className="text-emerald-700 font-medium">{selectedClass.subjectName}</p>
                <p className="text-gray-600 text-sm mt-1">
                  Take a photo of the class as proof of attendance
                </p>
                <p className="text-sm font-medium text-emerald-600 mt-2">
                  Class Time: {selectedClass.schedule.start} - {selectedClass.schedule.end}
                </p>
                {timeError && (
                  <div className="mt-2 p-2 bg-red-100 text-red-700 rounded-md text-sm">
                    {timeError}
                  </div>
                )}
              </div>
              
              {imagePreview ? (
                <div className="mb-6">
                  <img 
                    src={imagePreview} 
                    alt="Class verification preview" 
                    className="w-full h-48 object-cover rounded-xl border-2 border-emerald-100"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-emerald-300 rounded-xl p-8 mb-6 text-center bg-emerald-50">
                  <svg className="w-12 h-12 text-emerald-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <p className="text-emerald-600 font-medium">No image selected</p>
                  <p className="text-emerald-500 text-sm mt-1">Click below to take a photo</p>
                </div>
              )}
              
              <div className="space-y-3">
                <label className="block w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-center font-medium cursor-pointer transition-colors duration-200 shadow-lg">
                  Take Photo / Upload Image
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                
                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={() => {
                      setSelectedClass(null);
                      setImage(null);
                      setImagePreview(null);
                      setTimeError(null);
                    }}
                    className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors duration-200"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={verifyClass}
                    className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!image || uploading}
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading...
                      </span>
                    ) : "✓ Verify Class"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Class Cards Grid */}
        {classesToday.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-emerald-900 mb-2">No Classes Today</h3>
            <p className="text-emerald-600">Enjoy your day off! No classes are scheduled for today.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {classesToday.map((cls, idx) => (
              <ClassCard key={cls.id || idx} cls={cls} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffPage;