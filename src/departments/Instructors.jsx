import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Calendar, Clock, Users, BookOpen, ChevronDown, ChevronUp, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Instructors = () => {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedInstructor, setExpandedInstructor] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInstructors = async () => {
      try {
        // Get student's department from localStorage
        const studentDepartment = localStorage.getItem('studentDepartment');
        
        if (!studentDepartment) {
          setError("Student department not found");
          setLoading(false);
          return;
        }

        // Get all teachers in the same department as the student
        const q = query(
          collection(db, "users"), 
          where("role", "==", "teacher"),
          where("department", "==", studentDepartment)
        );
        
        const querySnapshot = await getDocs(q);
        const instructorsData = [];
        
        for (const docRef of querySnapshot.docs) {
          const instructor = docRef.data();
          const instructorId = docRef.id;
          
          // Get classes taught by this instructor
          const classesQuery = query(
            collection(db, "classes"),
            where("teacherID", "==", instructorId)
          );
          const classesSnapshot = await getDocs(classesQuery);
          
          // For each class, get the number of students
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
        setLoading(false);
      } catch (err) {
        console.error("Error fetching instructors:", err);
        setError("Failed to load instructors");
        setLoading(false);
      }
    };

    fetchInstructors();
  }, []);

  const toggleInstructor = (instructorId) => {
    setExpandedInstructor(expandedInstructor === instructorId ? null : instructorId);
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

  if (instructors.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium text-gray-700">No Instructors Found in Your Department</h3>
        <p className="text-gray-500 mt-2">There are currently no instructors registered in your department</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Instructors in Your Department</h1>
      
      {instructors.map((instructor) => (
        <div 
          key={instructor.id}
          className="bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200"
        >
          <div 
            className="p-5 cursor-pointer flex justify-between items-center hover:bg-gray-50"
            onClick={() => toggleInstructor(instructor.id)}
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold">
                {instructor.firstName?.charAt(0)}{instructor.lastName?.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800">
                  {instructor.firstName} {instructor.lastName}
                </h3>
                <p className="text-sm text-gray-500">{instructor.email}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Department: {instructor.department}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <BookOpen size={16} className="text-emerald-500 mr-1" />
                <span>{instructor.classes.length} classes</span>
              </div>
              
              {expandedInstructor === instructor.id ? (
                <ChevronUp size={20} className="text-gray-500" />
              ) : (
                <ChevronDown size={20} className="text-gray-500" />
              )}
            </div>
          </div>
          
          {expandedInstructor === instructor.id && (
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
      ))}
    </div>
  );
};

export default Instructors;