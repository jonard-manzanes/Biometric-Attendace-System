import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { collection, getDocs, doc, getDoc, updateDoc, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

const StaffPage = () => {
  const [classesToday, setClassesToday] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [timeError, setTimeError] = useState(null);
  const [staffId, setStaffId] = useState(null);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFilter, setSearchFilter] = useState("all"); // 'all', 'subject', 'teacher', 'department'
  const [verificationFilter, setVerificationFilter] = useState("all"); // 'all', 'verified', 'unverified'
  const navigate = useNavigate();

  // Convert time to 12-hour format with AM/PM
  const formatTimeTo12Hour = (timeStr) => {
    if (!timeStr) return "";
    
    if (timeStr.includes("AM") || timeStr.includes("PM")) {
      return timeStr;
    }

    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const timeToMinutes = (timeStr) => {
    if (timeStr.includes("AM") || timeStr.includes("PM")) {
      const [time, period] = timeStr.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      let total = hours * 60 + minutes;
      if (period === 'PM' && hours !== 12) total += 12 * 60;
      if (period === 'AM' && hours === 12) total -= 12 * 60;
      return total;
    }
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const isWithinClassTime = (startTime, endTime) => {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotal = currentHours * 60 + currentMinutes;
    
    const startTotal = timeToMinutes(startTime);
    const endTotal = timeToMinutes(endTime);
    
    return currentTotal >= (startTotal + 1) && currentTotal <= (endTotal - 1);
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      setStaffId(user.docId);
    } else {
      setClassesToday([]);
    }
  }, []);

  useEffect(() => {
    const fetchAssignedClasses = async () => {
      if (!staffId) return;

      const currentDate = new Date().toISOString().split('T')[0];
      const q = query(
        collection(db, "verificationTasks"),
        where("staffId", "==", staffId),
        where("date", "==", currentDate)
      );

      const querySnapshot = await getDocs(q);
      const assigned = querySnapshot.docs.map(doc => doc.data().classId);
      setAssignedClasses(assigned);
    };

    if (staffId) {
      fetchAssignedClasses();
    }
  }, [staffId]);

  useEffect(() => {
    const fetchClassesToday = async () => {
      if (!staffId) return;

      const today = new Date().toLocaleString("en-US", { weekday: "long" });
      const currentDate = new Date().toISOString().split('T')[0];
      
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
          let teacherDepartment = null;
          if (cls.teacherID) {
            try {
              const teacherDoc = await getDoc(doc(db, "users", cls.teacherID));
              if (teacherDoc.exists()) {
                const t = teacherDoc.data();
                teacherName =
                  `${t.firstName || ""} ${t.lastName || ""}`.trim() ||
                  "Unnamed Teacher";
                teacherDepartment = t.department;
              }
            } catch {
              teacherName = "Unknown Teacher";
            }
          }

          const todayVerification = cls.verifications?.find(
            v => v.date === currentDate || v.day === today
          );

          return {
            id: cls.id,
            subjectName: cls.subjectName,
            schedule: todaySchedule,
            joinCode: cls.joinCode,
            teacherName,
            teacherDepartment,
            verification: todayVerification || null,
          };
        })
      );

      // Filter to only show classes assigned to this staff member
      const filteredClasses = classesWithTeacher
        .filter(cls => cls !== null)
        .filter(cls => assignedClasses.includes(cls.id));

      setClassesToday(filteredClasses);
      setFilteredClasses(filteredClasses);
    };

    if (staffId) {
      fetchClassesToday();
    }
  }, [staffId, assignedClasses]);

  // Apply filters whenever search term, filter type, or classes change
  useEffect(() => {
    let results = classesToday;
    
    // Apply verification filter
    if (verificationFilter === 'verified') {
      results = results.filter(cls => cls.verification);
    } else if (verificationFilter === 'unverified') {
      results = results.filter(cls => !cls.verification);
    }
    
    // Apply search filter if there's a search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(cls => {
        if (searchFilter === 'subject') {
          return cls.subjectName.toLowerCase().includes(term);
        } else if (searchFilter === 'teacher') {
          return cls.teacherName.toLowerCase().includes(term);
        } else if (searchFilter === 'department') {
          return cls.teacherDepartment?.toLowerCase().includes(term);
        } else { // 'all'
          return (
            cls.subjectName.toLowerCase().includes(term) ||
            cls.teacherName.toLowerCase().includes(term) ||
            cls.teacherDepartment?.toLowerCase().includes(term) ||
            cls.joinCode?.toLowerCase().includes(term)
          );
        }
      });
    }
    
    setFilteredClasses(results);
  }, [searchTerm, searchFilter, verificationFilter, classesToday]);

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

    const { start, end } = selectedClass.schedule;
    if (!isWithinClassTime(start, end)) {
      setTimeError(`You can only verify this class between ${formatTimeTo12Hour(start)} and ${formatTimeTo12Hour(end)}`);
      return;
    }

    setUploading(true);
    try {
      const imageUrl = await uploadImageToCloudinary(image);
      const today = new Date().toLocaleString("en-US", { weekday: "long" });
      const currentDate = new Date().toISOString().split('T')[0];

      if (imageUrl) {
        const classRef = doc(db, "classes", selectedClass.id);
        const classDoc = await getDoc(classRef);
        const existingData = classDoc.data();
        
        const verifications = existingData.verifications || [];
        const updatedVerifications = verifications.filter(
          v => v.date !== currentDate && v.day !== today
        );
        
        updatedVerifications.push({
          day: today,
          date: currentDate,
          verified: true,
          verifiedAt: new Date().toISOString(),
          imageUrl,
          schedule: selectedClass.schedule,
          verifiedBy: JSON.parse(localStorage.getItem('user')).docId
        });

        await updateDoc(classRef, {
          verifications: updatedVerifications
        });

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
    const isAssigned = assignedClasses.includes(cls.id);
    const canVerify = isAssigned && !cls.verification && isWithinClassTime(cls.schedule.start, cls.schedule.end);
    const displayStartTime = formatTimeTo12Hour(cls.schedule.start);
    const displayEndTime = formatTimeTo12Hour(cls.schedule.end);
    
    return (
      <div className={`bg-white rounded-lg shadow-md overflow-hidden border hover:shadow-lg transition-shadow duration-200 ${
        cls.verification ? "border-emerald-300" : "border-gray-200"
      }`}>
        <div className="p-5">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-gray-800">{cls.subjectName}</h3>
            
            {cls.verification ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Verified
              </span>
            ) : !isAssigned ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
                Not Assigned
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                Unverified
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center text-gray-600">
              <svg className="w-4 h-4 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">{displayStartTime} - {displayEndTime}</span>
            </div>
            
            <div className="flex items-center text-gray-600">
              <svg className="w-4 h-4 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm">{cls.teacherName}</span>
            </div>
            
            {cls.teacherDepartment && (
              <div className="flex items-center text-gray-600">
                <svg className="w-4 h-4 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-sm">{cls.teacherDepartment}</span>
              </div>
            )}
            
            {cls.joinCode && (
              <div className="flex items-center text-gray-600">
                <svg className="w-4 h-4 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="text-sm">Code: {cls.joinCode}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
          {cls.verification ? (
            cls.verification.imageUrl && (
              <a 
                href={cls.verification.imageUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center px-4 py-2 bg-white text-emerald-600 rounded-md border border-emerald-600 hover:bg-emerald-50 transition-colors duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                View Proof
              </a>
            )
          ) : (
            <button 
              onClick={() => isAssigned && setSelectedClass(cls)}
              disabled={!canVerify}
              className={`w-full flex items-center justify-center px-4 py-2 rounded-md transition-colors duration-200 ${
                canVerify 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                  : isAssigned
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
              title={!isAssigned ? "This class is not assigned to you" : 
                     !canVerify ? `You can only verify this class between ${displayStartTime} and ${displayEndTime}` : ""}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {canVerify ? "Verify Class" : 
               isAssigned ? "Not Available" : "Not Assigned"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center">
          <div className="mb-4 md:mb-0">
            <h1 className="text-2xl font-bold text-emerald-700 mb-2">
              Your Assigned Classes
            </h1>
            <p className="text-sm text-gray-600">
              You can only verify classes that have been assigned to you
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-medium text-gray-800">{todayDate}</p>
            <p className="text-sm text-gray-600">Current time: {currentTime}</p>
          </div>
        </div>
      </div>
      
      {/* Search and Filter Section */}
<div className="bg-white rounded-xl shadow-md p-6 mb-8">
  <div className="flex flex-col md:flex-row gap-4 items-end">
    {/* Search Input - now with a label for proper alignment */}
    <div className="flex-1 w-full">
      <label htmlFor="class-search" className="block text-sm font-medium text-gray-700 mb-1 invisible">Search</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          id="class-search"
          type="text"
          placeholder="Search classes..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-emerald-500 focus:border-emerald-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
    </div>
    
    {/* Search Filter and Status */}
    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
      <div className="flex-1 min-w-[150px]">
        <label htmlFor="search-filter" className="block text-sm font-medium text-gray-700 mb-1">Search by</label>
        <select
          id="search-filter"
          className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-lg"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="subject">Subject</option>
          <option value="teacher">Teacher</option>
          <option value="department">Department</option>
        </select>
      </div>
      
      <div className="flex-1 min-w-[150px]">
        <label htmlFor="verification-filter" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          id="verification-filter"
          className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-lg"
          value={verificationFilter}
          onChange={(e) => setVerificationFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>
    </div>
  </div>
</div>
      
      {/* Verification Modal */}
      {selectedClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Verify Class
              </h2>
              <p className="text-emerald-600 font-medium">{selectedClass.subjectName}</p>
              <p className="text-gray-600 text-sm mt-1">
                Take a photo of the class as proof of attendance
              </p>
              <p className="text-sm font-medium text-gray-600 mt-2">
                Class Time: {formatTimeTo12Hour(selectedClass.schedule.start)} - {formatTimeTo12Hour(selectedClass.schedule.end)}
              </p>
              {timeError && (
                <div className="mt-2 p-2 bg-red-100 text-red-700 rounded-md text-sm border border-red-200">
                  {timeError}
                </div>
              )}
            </div>
            
            {imagePreview ? (
              <div className="mb-6">
                <img 
                  src={imagePreview} 
                  alt="Class verification preview" 
                  className="w-full h-48 object-cover rounded-lg border border-gray-200"
                />
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-6 text-center bg-gray-50">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <p className="text-gray-700 font-medium">No image selected</p>
                <p className="text-gray-500 text-sm mt-1">Click below to take a photo</p>
              </div>
            )}
            
            <div className="space-y-3">
              <label className="block w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-center font-medium cursor-pointer transition-colors duration-200 shadow-sm">
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
                  className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors duration-200"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  onClick={verifyClass}
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
      {filteredClasses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            {classesToday.length === 0 
              ? "No Classes Assigned to You Today" 
              : "No Classes Match Your Search"}
          </h3>
          <p className="text-gray-600">
            {classesToday.length === 0 
              ? "No classes have been assigned to you for today." 
              : "Try adjusting your search or filter criteria."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredClasses.map((cls, idx) => (
            <ClassCard key={cls.id || idx} cls={cls} />
          ))}
        </div>
      )}
    </div>
  );
};

export default StaffPage;