import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { format, parseISO, eachDayOfInterval, isMatch, parse } from "date-fns";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const Reports = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [classSchedule, setClassSchedule] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [dateRange, setDateRange] = useState({
    start: format(new Date(), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
  });
  const [showHolidayForm, setShowHolidayForm] = useState(false);

  // Get current teacher ID
  const getTeacherId = () => {
    const storedUserDocId = localStorage.getItem("userDocId");
    if (storedUserDocId) return storedUserDocId;

    const userString = localStorage.getItem("user");
    if (userString) {
      const user = JSON.parse(userString);
      return user.docId || user.uid;
    }

    return null;
  };

  // Fetch teacher info, classes, and holidays
  useEffect(() => {
    const fetchTeacherInfoAndClasses = async () => {
      try {
        const teacherId = getTeacherId();
        if (!teacherId) {
          setError("Teacher ID not found in localStorage");
          return;
        }

        // Fetch teacher info
        const teacherRef = doc(db, "users", teacherId);
        const teacherSnap = await getDoc(teacherRef);
        if (teacherSnap.exists()) {
          setTeacherInfo(teacherSnap.data());
        }

        // Fetch only classes that belong to this teacher
        const classesQuery = query(
          collection(db, "classes"),
          where("teacherID", "==", teacherId)
        );
        const classesSnapshot = await getDocs(classesQuery);

        const classesData = classesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setClasses(classesData);
        if (classesData.length > 0) {
          setSelectedClass(classesData[0].id);
          setClassSchedule(classesData[0].schedule || []);
        }

        // Fetch holidays for this teacher only
        const holidaysQuery = query(
          collection(db, "holidays"),
          where("teacherId", "==", teacherId)
        );
        const holidaysSnapshot = await getDocs(holidaysQuery);
        const holidaysData = holidaysSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setHolidays(holidaysData);
      } catch (err) {
        setError(`Error fetching data: ${err.message}`);
        console.error("Error fetching data:", err);
      }
    };

    fetchTeacherInfoAndClasses();
  }, []);

  // When selected class changes, update the schedule
  useEffect(() => {
    if (selectedClass) {
      const selected = classes.find((c) => c.id === selectedClass);
      if (selected) {
        setClassSchedule(selected.schedule || []);
      }
    }
  }, [selectedClass, classes]);

  // Filter dates based on class schedule days and exclude holidays
  const filterDatesBySchedule = (dates) => {
    if (!classSchedule || classSchedule.length === 0) return dates;

    const scheduleDays = classSchedule
      .filter((s) => s && typeof s.day === "string")
      .map((s) => s.day.toLowerCase());

    const holidayDates = holidays.map((h) => h.date);

    return dates.filter((date) => {
      if (holidayDates.includes(date)) return false;

      const parsedDate = parseISO(date);
      const dayName = format(parsedDate, "EEEE").toLowerCase();
      return scheduleDays.includes(dayName);
    });
  };

  // Check if a time falls within any of the class schedule times
  const isDuringClassTime = (timeStr, date) => {
    if (!timeStr || !classSchedule || classSchedule.length === 0) return false;

    const time = parse(timeStr, "HH:mm", new Date(date));
    if (isNaN(time)) return false;

    return classSchedule.some((session) => {
      const dayMatches =
        format(parseISO(date), "EEEE").toLowerCase() ===
        session.day.toLowerCase();
      if (!dayMatches) return false;

      const startTime = parse(session.start, "HH:mm", new Date(date));
      const endTime = parse(session.end, "HH:mm", new Date(date));

      return time >= startTime && time <= endTime;
    });
  };

  // Fetch attendance data when class or date range changes
  useEffect(() => {
    if (!selectedClass) return;

    const fetchAttendanceData = async () => {
      setLoading(true);
      setError(null);
      try {
        const classRef = doc(db, "classes", selectedClass);
        const classSnap = await getDoc(classRef);
        if (!classSnap.exists()) {
          setError("Class document not found");
          return;
        }
        const classData = classSnap.data();
        const attendanceClassID =
          classData.joinCode || classData.subjectName.replace(/\s/g, "_");

        const studentIDs = classData.studentIDs || [];
        if (studentIDs.length === 0) {
          setError("No students enrolled in this class");
          return;
        }

        // Generate date array from the selected dateRange
        const startDate = parseISO(dateRange.start);
        const endDate = parseISO(dateRange.end);
        const allDates = eachDayOfInterval({
          start: startDate,
          end: endDate,
        }).map((date) => format(date, "yyyy-MM-dd"));

        // Filter dates based on class schedule and exclude holidays
        const dateArray = filterDatesBySchedule(allDates);

        // Fetch attendance for each student and each date
        const attendancePromises = studentIDs.map(async (studentId) => {
          try {
            // Get student info
            const studentRef = doc(db, "users", studentId);
            const studentSnap = await getDoc(studentRef);
            if (!studentSnap.exists()) {
              console.warn(`Student document ${studentId} not found`);
              return null;
            }
            const studentData = studentSnap.data();
            if (!studentData?.firstName || !studentData?.lastName) {
              console.warn(`Student ${studentId} missing name data`);
              return null;
            }

            // Check attendance for each date
            const records = await Promise.all(
              dateArray.map(async (date) => {
                try {
                  const attendanceRef = doc(
                    db,
                    "attendance",
                    attendanceClassID,
                    date,
                    studentId
                  );
                  const attendanceSnap = await getDoc(attendanceRef);
                  if (attendanceSnap.exists()) {
                    const data = attendanceSnap.data() || {};
                    let timeIn = data.timeIn
                      ? typeof data.timeIn.toDate === "function"
                        ? data.timeIn.toDate()
                        : new Date(data.timeIn)
                      : null;
                    let timeOut = data.timeOut
                      ? typeof data.timeOut.toDate === "function"
                        ? data.timeOut.toDate()
                        : new Date(data.timeOut)
                      : null;

                    let excuseInfo = null;
                    if (data.excuse) {
                      excuseInfo = {
                        reason: data.excuse.reason || "No reason provided",
                        status: data.excuse.status || "pending",
                        image: data.excuse.image || null,
                      };
                    }

                    const timeInStr = timeIn ? format(timeIn, "HH:mm") : null;
                    const timeOutStr = timeOut
                      ? format(timeOut, "HH:mm")
                      : null;

                    const validTimeIn = timeInStr
                      ? isDuringClassTime(timeInStr, date)
                      : false;
                    const validTimeOut = timeOutStr
                      ? isDuringClassTime(timeOutStr, date)
                      : false;

                    let status;
                    if (validTimeIn && validTimeOut) {
                      status = "Present";
                    } else if (validTimeIn) {
                      status = "Time In Only";
                    } else if (excuseInfo) {
                      status =
                        excuseInfo.status === "approved"
                          ? "Excused Absence"
                          : "Pending Excuse";
                    } else {
                      status = "Absent";
                    }

                    return {
                      date,
                      timeIn: timeIn ? format(timeIn, "hh:mm a") : null,
                      timeOut: timeOut ? format(timeOut, "hh:mm a") : null,
                      verificationMethod:
                        data.verificationMethod || data.verifiedBy || null,
                      status,
                      excuse: excuseInfo,
                      isValidTimeIn: validTimeIn,
                      isValidTimeOut: validTimeOut,
                    };
                  }
                } catch (err) {
                  console.error(`Error fetching attendance for ${date}:`, err);
                }
                return {
                  date,
                  timeIn: null,
                  timeOut: null,
                  verificationMethod: null,
                  status: "Absent",
                  excuse: null,
                  isValidTimeIn: false,
                  isValidTimeOut: false,
                };
              })
            );

            return {
              studentId,
              studentName: `${studentData.firstName} ${studentData.lastName}`,
              records,
            };
          } catch (err) {
            console.error(`Error processing student ${studentId}:`, err);
            return null;
          }
        });

        const results = (await Promise.all(attendancePromises)).filter(Boolean);
        setAttendanceData(results);
      } catch (err) {
        setError(`Error fetching attendance data: ${err.message}`);
        console.error("Error fetching attendance data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceData();
  }, [selectedClass, dateRange, classSchedule, holidays]);

  const handleDateChange = (e) => {
    setDateRange({
      ...dateRange,
      [e.target.name]: e.target.value,
    });
  };

  // Add new holiday for current teacher
  const addHoliday = async () => {
    try {
      const teacherId = getTeacherId();
      if (!teacherId) {
        setError("Teacher ID not found");
        return;
      }

      const holidayToAdd = {
        date: newHoliday.date,
        description: newHoliday.description,
        teacherId: teacherId,
      };

      const docRef = await addDoc(collection(db, "holidays"), holidayToAdd);
      setHolidays([
        ...holidays,
        { id: docRef.id, ...holidayToAdd },
      ]);
      setNewHoliday({
        date: format(new Date(), "yyyy-MM-dd"),
        description: "",
      });
      setShowHolidayForm(false);
    } catch (err) {
      setError(`Error adding holiday: ${err.message}`);
      console.error("Error adding holiday:", err);
    }
  };

  // Delete holiday
  const deleteHoliday = async (holidayId) => {
    try {
      await deleteDoc(doc(db, "holidays", holidayId));
      setHolidays(holidays.filter((h) => h.id !== holidayId));
    } catch (err) {
      setError(`Error deleting holiday: ${err.message}`);
      console.error("Error deleting holiday:", err);
    }
  };

  // Download attendance report as CSV
  const downloadAttendanceReport = () => {
    if (!selectedClass || attendanceData.length === 0) return;

    const classInfo = classes.find((c) => c.id === selectedClass);
    if (!classInfo) return;

    const startDate = dateRange.start;
    const endDate = dateRange.end;

    const headers = ["Student Name"];
    const dateColumns = attendanceData[0].records.map(record => record.date);
    
    dateColumns.forEach(date => {
      headers.push(format(parseISO(date), "MMM d (EEEE)"));
    });

    const studentRows = attendanceData.map(student => {
      const row = [student.studentName];
      student.records.forEach(record => {
        let status = record.status;
        if (record.timeIn) status += ` (In: ${record.timeIn})`;
        if (record.timeOut) status += ` (Out: ${record.timeOut})`;
        if (record.excuse) status += ` [Excuse: ${record.excuse.reason}]`;
        row.push(status);
      });
      return row;
    });

    const csvContent = [
      ["Attendance Report", "", "", "", ""],
      ["Date Range:", `${startDate} to ${endDate}`, "", "", ""],
      ["Subject:", classInfo.subjectName, "", "", ""],
      [
        "Instructor:",
        teacherInfo ? `${teacherInfo.firstName} ${teacherInfo.lastName}` : "",
        "",
        "",
        ""
      ],
      [
        "Class Schedule:",
        classSchedule.map((s) => `${s.day} ${s.start}-${s.end}`).join(", "),
        "",
        "",
        ""
      ],
      ["Holidays:", holidays.map(h => `${h.date}: ${h.description}`).join("; "), "", "", ""],
      ["", "", "", "", ""],
      headers,
      ...studentRows
    ]
      .map(row => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `attendance_${classInfo.subjectName}_${startDate}_to_${endDate}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Aggregate attendance data for chart display
  const aggregatedData = useMemo(() => {
    if (attendanceData.length === 0) return null;

    const dates = attendanceData[0].records.map((rec) => rec.date);
    const presentCounts = dates.map((date) =>
      attendanceData.reduce((sum, student) => {
        const record = student.records.find((r) => r.date === date);
        return sum + (record && record.status === "Present" ? 1 : 0);
      }, 0)
    );
    const timeInOnlyCounts = dates.map((date) =>
      attendanceData.reduce((sum, student) => {
        const record = student.records.find((r) => r.date === date);
        return sum + (record && record.status === "Time In Only" ? 1 : 0);
      }, 0)
    );
    const excusedCounts = dates.map((date) =>
      attendanceData.reduce((sum, student) => {
        const record = student.records.find((r) => r.date === date);
        return sum + (record && record.status === "Excused Absence" ? 1 : 0);
      }, 0)
    );
    const pendingExcuseCounts = dates.map((date) =>
      attendanceData.reduce((sum, student) => {
        const record = student.records.find((r) => r.date === date);
        return sum + (record && record.status === "Pending Excuse" ? 1 : 0);
      }, 0)
    );
    const absentCounts = dates.map((date) =>
      attendanceData.reduce((sum, student) => {
        const record = student.records.find((r) => r.date === date);
        return sum + (record && record.status === "Absent" ? 1 : 0);
      }, 0)
    );

    return {
      labels: dates.map((date) => format(parseISO(date), "MMM d (EEEE)")),
      datasets: [
        {
          label: "Present",
          data: presentCounts,
          backgroundColor: "green",
        },
        {
          label: "Time In Only",
          data: timeInOnlyCounts,
          backgroundColor: "yellow",
        },
        {
          label: "Excused Absence",
          data: excusedCounts,
          backgroundColor: "blue",
        },
        {
          label: "Pending Excuse",
          data: pendingExcuseCounts,
          backgroundColor: "orange",
        },
        {
          label: "Absent",
          data: absentCounts,
          backgroundColor: "red",
        },
      ],
    };
  }, [attendanceData]);

  // Function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "Present":
        return "bg-green-100 text-green-800";
      case "Time In Only":
        return "bg-yellow-100 text-yellow-800";
      case "Excused Absence":
        return "bg-blue-100 text-blue-800";
      case "Pending Excuse":
        return "bg-orange-100 text-orange-800";
      case "Absent":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Attendance Reports</h1>
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p>{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Class
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded"
              value={selectedClass || ""}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.subjectName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              name="start"
              value={dateRange.start}
              onChange={handleDateChange}
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              name="end"
              value={dateRange.end}
              onChange={handleDateChange}
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
        </div>

        {/* Class schedule display */}
        {classSchedule && classSchedule.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700">Class Schedule:</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {classSchedule.map((session, index) => (
                <span
                  key={index}
                  className="bg-gray-100 px-2 py-1 rounded text-sm"
                >
                  {session.day} {session.start}-{session.end}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Holidays management */}
        <div className="mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-gray-700">Holidays/No Class Days:</p>
            <button
              onClick={() => setShowHolidayForm(!showHolidayForm)}
              className="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
            >
              {showHolidayForm ? "Cancel" : "+ Add Holiday"}
            </button>
          </div>
          
          {showHolidayForm && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday({...newHoliday, date: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newHoliday.description}
                      onChange={(e) => setNewHoliday({...newHoliday, description: e.target.value})}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm"
                      placeholder="E.g., Thanksgiving Break"
                    />
                    <button
                      onClick={addHoliday}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded text-sm"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {holidays.length > 0 && (
            <div className="mt-2">
              {holidays.map((holiday) => (
                <div key={holiday.id} className="flex justify-between items-center bg-gray-100 p-2 rounded mb-1">
                  <div>
                    <span className="font-medium text-sm">{holiday.date}</span>
                    {holiday.description && (
                      <span className="text-sm ml-2">- {holiday.description}</span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteHoliday(holiday.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Download button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={downloadAttendanceReport}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded"
            disabled={loading || !selectedClass || attendanceData.length === 0}
          >
            Download Attendance Report
          </button>
        </div>
      </div>

      {/* Attendance Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    {attendanceData.length > 0 &&
                      attendanceData[0].records.map((record) => (
                        <th
                          key={record.date}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {format(parseISO(record.date), "MMM d (EEEE)")}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceData.map((student) => (
                    <tr key={student.studentId}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {student.studentName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {student.studentId}
                        </div>
                      </td>

                      {student.records.map((record) => (
                        <td
                          key={`${student.studentId}-${record.date}`}
                          className="px-4 py-2"
                        >
                          <div className="flex flex-col items-center">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                record.status
                              )}`}
                            >
                              {record.status}
                            </span>

                            {record.timeIn && (
                              <span
                                className={`text-xs ${
                                  record.isValidTimeIn
                                    ? "text-gray-500"
                                    : "text-red-500"
                                }`}
                              >
                                In: {record.timeIn}
                              </span>
                            )}
                            {record.timeOut && (
                              <span
                                className={`text-xs ${
                                  record.isValidTimeOut
                                    ? "text-gray-500"
                                    : "text-red-500"
                                }`}
                              >
                                Out: {record.timeOut}
                              </span>
                            )}
                            {record.excuse && (
                              <div className="mt-1 text-xs text-gray-600">
                                <div className="font-medium">Excuse:</div>
                                <div>{record.excuse.reason}</div>
                                {record.excuse.status === "pending" && (
                                  <div className="text-orange-500">
                                    (Pending)
                                  </div>
                                )}
                              </div>
                            )}
                            {record.verificationMethod && (
                              <span className="text-xs text-gray-400 mt-1">
                                {record.verificationMethod}
                              </span>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Attendance Summary Chart */}
            {aggregatedData && (
              <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">
                  Attendance Summary Chart
                </h2>
                <Bar
                  data={aggregatedData}
                  options={{
                    responsive: true,
                    plugins: { legend: { position: "top" } },
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;