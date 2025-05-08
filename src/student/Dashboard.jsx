import React from "react";
import Swal from "sweetalert2";
import { db } from "../firebaseConfig";
import { collection, query, where, getDocs, doc,updateDoc } from "firebase/firestore";

const Dashboard = ({ currentUser }) => {

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
        // Show loading dialog
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
  
  
  

  return (
    <div>
      <div className="flex flex-col">
        <h1 className="mt-2 text-center md:text-start md:text-2xl mb-2">Welcome to Dashboard</h1>
        <button
          className="mt-2 bg-emerald-300 py-2 px-6 text-sm rounded text-white md:w-40"
          onClick={joinButtonClick}
        >
          Join
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
