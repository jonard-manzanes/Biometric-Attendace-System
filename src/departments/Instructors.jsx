import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import { collection, getDocs, query, where, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { Calendar, Users, BookOpen, ChevronDown, ChevronUp, User, Trash2, Search, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

const Instructors = () => {
  const [instructors, setInstructors] = useState([]);
  const [filteredInstructors, setFilteredInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedInstructor, setExpandedInstructor] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [updatingRoleId, setUpdatingRoleId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchInstructors();
  }, []);

  useEffect(() => {
    const results = instructors.filter(instructor => {
      const searchLower = searchTerm.toLowerCase();
      return (
        instructor.firstName?.toLowerCase().includes(searchLower) ||
        instructor.lastName?.toLowerCase().includes(searchLower) ||
        instructor.email?.toLowerCase().includes(searchLower) ||
        instructor.id?.toLowerCase().includes(searchLower)
      );
    });
    setFilteredInstructors(results);
  }, [searchTerm, instructors]);

  const fetchInstructors = async () => {
    try {
      setLoading(true);
      const studentDepartment = localStorage.getItem('studentDepartment');
      
      if (!studentDepartment) {
        setError("Student department not found");
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, "users"), 
        where("role", "in", ["teacher", "student"]), // Include both teachers and students
        where("department", "==", studentDepartment)
      );
      
      const querySnapshot = await getDocs(q);
      const instructorsData = [];
      
      for (const docRef of querySnapshot.docs) {
        const instructor = docRef.data();
        const instructorId = docRef.id;
        
        // Only fetch classes for teachers
        const classesQuery = query(
          collection(db, "classes"),
          where("teacherID", "==", instructorId)
        );
        const classesSnapshot = await getDocs(classesQuery);
        
        const classesWithStudentCount = await Promise.all(
          classesSnapshot.docs.map(async (doc) => {
            const classData = doc.data();
            return {
              id: doc.id,
              ...classData,
              studentCount: classData.studentIDs?.length || 0
            };
          })
        );
        
        instructorsData.push({
          id: instructorId,
          ...instructor,
          classes: classesWithStudentCount
        });
      }
      
      setInstructors(instructorsData);
      setFilteredInstructors(instructorsData);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching instructors:", err);
      setError("Failed to load instructors");
      setLoading(false);
    }
  };

  const toggleInstructor = (instructorId) => {
    setExpandedInstructor(expandedInstructor === instructorId ? null : instructorId);
  };

  const handleUpdateRole = async (userId, currentRole) => {
    const newRole = currentRole === "teacher" ? "student" : "teacher";
    
    const result = await MySwal.fire({
      title: 'Change Role?',
      text: `Are you sure you want to change this user's role from ${currentRole} to ${newRole}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, change it!',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    setUpdatingRoleId(userId);
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { role: newRole });
      
      // Update local state
      setInstructors(instructors.map(instructor => 
        instructor.id === userId ? { ...instructor, role: newRole } : instructor
      ));
      
      await MySwal.fire({
        title: 'Updated!',
        text: `User role changed to ${newRole}`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      console.error("Error updating role:", err);
      await MySwal.fire({
        title: 'Error!',
        text: 'Failed to update role. Please try again.',
        icon: 'error'
      });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleDeleteInstructor = async (instructorId) => {
    const result = await MySwal.fire({
      title: 'Delete Instructor?',
      text: "This will permanently delete the instructor and all their classes. This action cannot be undone!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      backdrop: `
        rgba(0,0,0,0.7)
        url("/images/nyan-cat.gif")
        left top
        no-repeat
      `
    });

    if (!result.isConfirmed) return;

    setDeletingId(instructorId);
    try {
      // Delete all classes first
      const classesQuery = query(
        collection(db, "classes"),
        where("teacherID", "==", instructorId)
      );
      const classesSnapshot = await getDocs(classesQuery);
      
      const deleteClassPromises = classesSnapshot.docs.map(async (classDoc) => {
        await deleteDoc(doc(db, "classes", classDoc.id));
      });
      
      await Promise.all(deleteClassPromises);
      
      // Then delete the instructor
      await deleteDoc(doc(db, "users", instructorId));
      
      // Update UI
      setInstructors(instructors.filter(instructor => instructor.id !== instructorId));
      
      await MySwal.fire({
        title: 'Deleted!',
        text: 'The instructor and their classes have been deleted.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      console.error("Error deleting instructor:", err);
      await MySwal.fire({
        title: 'Error!',
        text: 'Failed to delete instructor. Please try again.',
        icon: 'error'
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading instructors...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 text-red-700">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Users in Your Department</h1>
        <button 
          onClick={fetchInstructors}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <RefreshCw size={16} className="mr-1" />
          Refresh
        </button>
      </div>
      
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by name, email, or ID..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {filteredInstructors.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-700">
            {searchTerm ? "No matching users found" : "No Users Found in Your Department"}
          </h3>
          <p className="text-gray-500 mt-2">
            {searchTerm ? "Try a different search term" : "There are currently no users registered in your department"}
          </p>
        </div>
      ) : (
        filteredInstructors.map((instructor) => (
          <div 
            key={instructor.id}
            className="bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200"
          >
            <div 
              className="p-5 cursor-pointer flex justify-between items-center hover:bg-gray-50"
              onClick={() => toggleInstructor(instructor.id)}
            >
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                  instructor.role === "teacher" 
                    ? "bg-emerald-100 text-emerald-600" 
                    : "bg-blue-100 text-blue-600"
                }`}>
                  {instructor.firstName?.charAt(0)}{instructor.lastName?.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">
                    {instructor.firstName} {instructor.lastName}
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      instructor.role === "teacher" 
                        ? "bg-emerald-100 text-emerald-800" 
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {instructor.role}
                    </span>
                  </h3>
                  <p className="text-sm text-gray-500">{instructor.email}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Department: {instructor.department}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {instructor.role === "teacher" && (
                  <div className="flex items-center text-sm text-gray-600">
                    <BookOpen size={16} className="text-emerald-500 mr-1" />
                    <span>{instructor.classes.length} classes</span>
                  </div>
                )}
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateRole(instructor.id, instructor.role);
                  }}
                  disabled={updatingRoleId === instructor.id}
                  className={`px-3 py-1 text-sm rounded-md ${
                    instructor.role === "teacher" 
                      ? "bg-blue-100 text-blue-800 hover:bg-blue-200" 
                      : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  } transition-colors`}
                  title={`Change to ${instructor.role === "teacher" ? "student" : "instructor"}`}
                >
                  {updatingRoleId === instructor.id ? (
                    "Updating..."
                  ) : (
                    `Make ${instructor.role === "teacher" ? "Student" : "Instructor"}`
                  )}
                </button>
                
                {instructor.role === "teacher" && (
                  <>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteInstructor(instructor.id);
                      }}
                      disabled={deletingId === instructor.id}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      title="Delete instructor"
                    >
                      {deletingId === instructor.id ? (
                        <span className="text-sm">Deleting...</span>
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                    
                    {expandedInstructor === instructor.id ? (
                      <ChevronUp size={20} className="text-gray-500" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-500" />
                    )}
                  </>
                )}
              </div>
            </div>
            
            {expandedInstructor === instructor.id && instructor.role === "teacher" && (
              <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                  <Users size={16} className="mr-2 text-emerald-500" />
                  Teaching Classes
                </h4>
                
                {instructor.classes.length === 0 ? (
                  <p className="text-sm text-gray-500 pl-6">This instructor is not teaching any classes yet</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {instructor.classes.map((classItem) => (
                      <div 
                        key={classItem.id}
                        className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-emerald-300 transition-colors cursor-pointer"
                        onClick={() => navigate(`/classes/${classItem.id}`)}
                      >
                        <h5 className="font-bold text-gray-800 mb-2">{classItem.subjectName}</h5>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center text-sm text-gray-600">
                              <span className="bg-emerald-100 text-emerald-800 text-xs font-medium px-2 py-0.5 rounded mr-2">
                                Code: {classItem.joinCode}
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <User size={14} className="text-emerald-500 mr-1" />
                              <span>{classItem.studentCount} students</span>
                            </div>
                          </div>
                          
                          {classItem.schedule && classItem.schedule.length > 0 && (
                            <div className="mt-2">
                              {classItem.schedule.slice(0, 2).map((sched, index) => (
                                <div key={index} className="flex items-center text-sm text-gray-600 mb-1">
                                  <Calendar size={14} className="text-emerald-500 mr-1" />
                                  <span className="font-medium mr-1">{sched.day}:</span>
                                  <span>{sched.start} - {sched.end}</span>
                                </div>
                              ))}
                              {classItem.schedule.length > 2 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  +{classItem.schedule.length - 2} more schedules
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default Instructors;