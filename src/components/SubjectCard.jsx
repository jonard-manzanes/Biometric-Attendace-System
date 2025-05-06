import React from 'react';

const SubjectCard = ({ subject, schedule, teacher }) => {
  return (
    <div className="p-4 border rounded-lg shadow-lg bg-white">
      <h3 className="text-xl font-semibold text-gray-800">{subject}</h3>
      <p className="text-gray-600">{schedule}</p>
      <p className="text-gray-600">Teacher: {teacher}</p>
    </div>
  );
};

export default SubjectCard;
