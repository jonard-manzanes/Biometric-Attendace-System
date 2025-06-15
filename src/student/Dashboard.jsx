import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { db } from "../firebaseConfig";
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";

const Dashboard = ({ currentUser }) => {
  const [suggestedClasses, setSuggestedClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestedClasses = async () => {
      try {
        const studentDepartment = localStorage.getItem('studentDepartment');
        const studentId = localStorage.getItem('userDocId');
        
        if (!studentDepartment) {
          setLoading(false);
          return;
        }

        // Get all classes
        const classesSnapshot = await getDocs(collection(db, "classes"));
        const allClasses = classesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter classes where teacher's department matches student's department
        const suggested = [];
        for (const cls of allClasses) {
          // Skip classes the student is already enrolled in
          if (cls.studentIDs?.includes(studentId)) continue;
          
          // Get teacher data
          const teacherRef = doc(db, "users", cls.teacherID);
          const teacherDoc = await getDoc(teacherRef);
          
          if (teacherDoc.exists()) {
            const teacherData = teacherDoc.data();
            // Check if teacher has same department
            if (teacherData.department === studentDepartment) {
              const teacherName = `${teacherData.firstName} ${
                teacherData.middle ? teacherData.middle + " " : ""
              }${teacherData.lastName}`;
              
              suggested.push({
                ...cls,
                teacherName,
                isSuggested: true,
              });
            }
          }
        }
        
        setSuggestedClasses(suggested);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching suggested classes:", error);
        setLoading(false);
      }
    };

    fetchSuggestedClasses();
  }, []);

  const joinButtonClick = async () => {
    const storedUser = localStorage.getItem('user');
  
    if (!storedUser) {
      Swal.fire({
        icon: 'error',
        title: 'User not logged in',
        text: 'Please log in to join a class.',
      });
      return;
    }
  
    const parsedUser = JSON.parse(storedUser);
  
    if (!parsedUser.docId) {
      Swal.fire({
        icon: 'error',
        title: 'Missing User Data',
        text: 'Unable to retrieve user data. Please log in again.',
      });
      return;
    }
  
    const { value: code } = await Swal.fire({
      title: 'Join Subject',
      input: 'text',
      inputPlaceholder: 'Enter class code here',
      confirmButtonText: 'Join',
      inputValidator: (value) => {
        if (!value) {
          return 'Please input the code!';
        }
      }
    });
  
    if (code) {
      try {
        Swal.fire({
          title: 'Joining class...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
  
        const q = query(collection(db, "classes"), where("joinCode", "==", code));
        const querySnapshot = await getDocs(q);
  
        if (querySnapshot.empty) {
          Swal.fire({
            icon: 'error',
            title: 'Class not found',
            text: 'The class code you entered is incorrect or expired.',
          });
        } else {
          const classData = querySnapshot.docs[0].data();
          const classId = querySnapshot.docs[0].id;
  
          if (classData.studentIDs.includes(parsedUser.uid)) {
            Swal.fire({
              icon: 'info',
              title: 'Already Joined',
              text: 'You have already joined this class.',
            });
          } else {
            const classRef = doc(db, "classes", classId);
            await updateDoc(classRef, {
              studentIDs: [...classData.studentIDs, parsedUser.uid],
            });
  
            Swal.fire({
              icon: 'success',
              title: 'Successfully Joined',
              text: 'You have joined the class.',
            });
          }
        }
      } catch (error) {
        console.error("Error joining class:", error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'There was an error while joining the class. Please try again.',
        });
      }
    }
  };

  const joinSuggestedClass = async (classId, className) => {
    try {
      const studentId = localStorage.getItem('userDocId');
      if (!studentId) {
        throw new Error("Student ID not found");
      }

      Swal.fire({
        title: 'Joining class...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const classRef = doc(db, "classes", classId);
      const classDoc = await getDoc(classRef);

      if (!classDoc.exists()) {
        throw new Error("Class not found");
      }

      const classData = classDoc.data();

      if (classData.studentIDs.includes(studentId)) {
        Swal.fire({
          icon: 'info',
          title: 'Already Joined',
          text: 'You have already joined this class.',
        });
        return;
      }

      await updateDoc(classRef, {
        studentIDs: [...classData.studentIDs, studentId],
      });

      Swal.fire({
        icon: 'success',
        title: 'Successfully Joined',
        text: `You have joined ${className}.`,
      });

      // Refresh suggested classes
      const updatedSuggested = suggestedClasses.filter(cls => cls.id !== classId);
      setSuggestedClasses(updatedSuggested);
    } catch (error) {
      console.error("Error joining suggested class:", error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'There was an error while joining the class. Please try again.',
      });
    }
  };

  return (
    <div >
      <div className="flex flex-col mb-8">
        <h1 className="mt-2 text-center md:text-start md:text-2xl mb-2">Welcome to Dashboard</h1>
        <button
          className="mt-2 bg-emerald-500 hover:bg-emerald-600 py-2 px-6 text-sm rounded text-white md:w-40 transition-colors duration-200"
          onClick={joinButtonClick}
        >
          Join Class
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : suggestedClasses.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Suggested Classes</h2>
          <p className="text-gray-600 mb-4">
            These classes are taught by teachers in your department
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {suggestedClasses.map((cls) => (
              <div key={cls.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                <div className="p-4">
                  <h3 className="font-bold text-lg text-gray-800 mb-2">{cls.subjectName}</h3>
                  <div className="flex items-center mb-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-500 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                    <p className="text-sm text-gray-700">{cls.teacherName}</p>
                  </div>
                  <button
                    onClick={() => joinSuggestedClass(cls.id, cls.subjectName)}
                    className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded text-sm transition-colors duration-200"
                  >
                    Join Class
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Suggested because you're in {cls.department} department
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-blue-800">No suggested classes found based on your department.</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;