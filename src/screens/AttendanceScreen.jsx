import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
} from "react-native";
import { db, auth } from "../FireBase/FireBaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import useWebAlert from "../components/WebAlertModal";

export default function AttendanceScreen({ route }) {
  const { showAlert, AlertModal } = useWebAlert();

  const [activeTab, setActiveTab] = useState(
    Math.min(route?.params?.activeTab ?? 0, 1),
  );
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  const [classes, setClasses] = useState([]);
  const [subjectName, setSubjectName] = useState("");
  const [section, setSection] = useState("");
  const [schedule, setSchedule] = useState("");

  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [currentClassId, setCurrentClassId] = useState(null);
  const [currentClassName, setCurrentClassName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [modalStudents, setModalStudents] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [attendanceMap, setAttendanceMap] = useState({});
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [attendanceDate] = useState(new Date().toISOString().split("T")[0]);

  const [classSummary, setClassSummary] = useState({
    present: 0,
    absent: 0,
    late: 0,
    rate: 0,
  });
  const [studentAttendanceSummary, setStudentAttendanceSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return unsub;
  }, []);

  useEffect(() => {
    if (currentUser) loadClasses();
  }, [currentUser]);

  useEffect(() => {
    if (selectedClassId) loadStudents(selectedClassId, false);
  }, [selectedClassId]);

  useEffect(() => {
    if (route?.params?.classId) {
      setSelectedClassId(route.params.classId);
      if (route.params.openStudentsModal) {
        setActiveTab(0);
        setShowStudentsModal(true);
        setCurrentClassId(route.params.classId);
        setCurrentClassName("");
        loadStudents(route.params.classId, true);
        loadClassOverviewData(route.params.classId);
      }
    }
  }, [route?.params?.classId, route?.params?.openStudentsModal]);

  useEffect(() => {
    if (classes.length > 0 && route?.params?.classId) {
      const cls = classes.find((c) => c.id === route.params.classId);
      if (cls) setCurrentClassName(`${cls.subject_name} – ${cls.section}`);
    }
  }, [classes, route?.params?.classId]);

  const loadClassOverviewData = async (classId) => {
    if (!classId) return;
    try {
      const snap = await getDocs(
        query(collection(db, "attendance"), where("classId", "==", classId)),
      );
      let p = 0,
        a = 0,
        l = 0;
      const summary = {};

      snap.docs.forEach((d) => {
        const rec = d.data();
        const sid = rec.studentId;
        const status = rec.status?.toLowerCase();
        if (!summary[sid])
          summary[sid] = { present: 0, absent: 0, late: 0, records: [] };
        if (status === "present") {
          p++;
          summary[sid].present++;
        } else if (status === "absent") {
          a++;
          summary[sid].absent++;
        } else if (status === "late") {
          l++;
          summary[sid].late++;
        }
        summary[sid].records.push({ date: rec.date, status: rec.status });
      });

      Object.values(summary).forEach((e) =>
        e.records.sort((x, y) => y.date.localeCompare(x.date)),
      );

      const total = p + a + l;
      setClassSummary({
        present: p,
        absent: a,
        late: l,
        rate: total === 0 ? 0 : Math.round((p / total) * 100),
      });
      setStudentAttendanceSummary(summary);
    } catch (err) {
      console.error("Failed to load class overview:", err);
      setClassSummary({ present: 0, absent: 0, late: 0, rate: 0 });
      setStudentAttendanceSummary({});
    }
  };

  const loadClasses = async () => {
    const user = auth.currentUser || currentUser;
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "classes"), where("teacherId", "==", user.uid)),
      );
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading classes:", err);
      if (
        err.code === "permission-denied" ||
        err.message?.includes("Missing or insufficient permissions")
      ) {
        setPermissionError(true);
      }
      showAlert("Error", "Failed to load classes");
    }
    setLoading(false);
  };

  const loadStudents = async (classId, forModal = false) => {
    try {
      const snap = await getDocs(
        query(collection(db, "students"), where("classId", "==", classId)),
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (forModal) setModalStudents(list);
      else setStudents(list);
    } catch (err) {
      console.error("Error loading students:", err);
      if (
        err.code === "permission-denied" ||
        err.message?.includes("Missing or insufficient permissions")
      ) {
        setPermissionError(true);
      }
      showAlert("Error", "Failed to load students");
    }
  };

  const deleteClass = async (classId) => {
    try {
      await deleteDoc(doc(db, "classes", classId));
      showAlert("Success", "Class deleted!");
      loadClasses();
      if (selectedClassId === classId) {
        setSelectedClassId(null);
        setStudents([]);
      }
    } catch {
      showAlert("Error", "Failed to delete class");
    }
  };

  const addStudent = async () => {
    if (!studentName || !studentNumber || !currentClassId) {
      showAlert("Error", "Please fill all fields");
      return;
    }
    try {
      const existing = await getDocs(
        query(
          collection(db, "students"),
          where("classId", "==", currentClassId),
          where("student_number", "==", studentNumber),
        ),
      );
      if (!existing.empty) {
        showAlert("Error", "Student ID already exists in this class");
        return;
      }
      const docId = `${currentClassId}_${studentNumber}_${studentName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "_");
      await setDoc(doc(db, "students", docId), {
        classId: currentClassId,
        name: studentName,
        student_number: studentNumber,
        createdAt: serverTimestamp(),
      });
      showAlert("Success", "Student added!");
      setStudentName("");
      setStudentNumber("");
      loadStudents(currentClassId, true);
    } catch {
      showAlert("Error", "Failed to add student");
    }
  };

  const deleteStudent = async (studentId) => {
    try {
      await deleteDoc(doc(db, "students", studentId));
      showAlert("Success", "Student removed!");
      loadStudents(currentClassId, true);
    } catch {
      showAlert("Error", "Failed to remove student");
    }
  };

  const addNewClass = async () => {
    if (!subjectName || !section) {
      showAlert("Error", "Please enter subject name and section");
      return;
    }
    const user = auth.currentUser || currentUser;
    if (!user) {
      showAlert("Error", "You must be logged in to add a class");
      return;
    }
    try {
      const docId = `${user.uid}_${subjectName}_${section}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "_");
      await setDoc(doc(db, "classes", docId), {
        teacherId: user.uid,
        subject_name: subjectName,
        section,
        schedule: schedule || "",
        createdAt: serverTimestamp(),
      });
      showAlert("Success", "Class added successfully!");
      setSubjectName("");
      setSection("");
      setSchedule("");
      loadClasses();
    } catch (err) {
      console.error("Error adding class:", err);
      if (
        err.code === "permission-denied" ||
        err.message?.includes("Missing or insufficient permissions")
      ) {
        setPermissionError(true);
      }
      showAlert("Error", `Failed to add class: ${err.message}`);
    }
  };

  const saveAttendance = async () => {
    if (Object.keys(attendanceMap).length === 0) {
      showAlert("Warning", "No attendance marked yet");
      return;
    }
    if (!selectedClassId) {
      showAlert("Error", "Please select a class");
      return;
    }
    setLoading(true);
    try {
      const user = auth.currentUser || currentUser;
      await Promise.all(
        Object.entries(attendanceMap).map(async ([studentId, status]) => {
          const existing = await getDocs(
            query(
              collection(db, "attendance"),
              where("studentId", "==", studentId),
              where("classId", "==", selectedClassId),
              where("date", "==", attendanceDate),
            ),
          );
          for (const d of existing.docs)
            await deleteDoc(doc(db, "attendance", d.id));
          return addDoc(collection(db, "attendance"), {
            studentId,
            classId: selectedClassId,
            teacherId: user.uid,
            status,
            date: attendanceDate,
            createdAt: serverTimestamp(),
          });
        }),
      );
      showAlert("Success", "Attendance saved!");
      setAttendanceMap({});
    } catch (err) {
      console.error("Error saving attendance:", err);
      if (
        err.code === "permission-denied" ||
        err.message?.includes("Missing or insufficient permissions")
      ) {
        setPermissionError(true);
      }
      showAlert("Error", "Failed to save attendance");
    }
    setLoading(false);
  };

  const toggleAttendance = (studentId, status) => {
    setAttendanceMap((prev) => {
      if (prev[studentId] === status) {
        const { [studentId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [studentId]: status };
    });
  };

  const filtered = students.filter(
    (s) =>
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_number?.includes(searchQuery),
  );

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  if (permissionError) {
    return (
      <View style={[s.container, s.center]}>
        <Text style={s.sectionTitle}>Firestore Permission Error</Text>
        <Text style={s.emptyText}>
          Your Firestore rules are blocking read/write access. Update your
          security rules in the Firebase console to allow authenticated users.
        </Text>
      </View>
    );
  }

  if (!currentUser && !auth.currentUser) {
    return (
      <View style={[s.container, s.center]}>
        <Text style={s.emptyText}>
          Please log in to access attendance features.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Classes and Students</Text>
      </View>

      <View style={s.tabRow}>
        {["My Classes", "Mark Attendance"].map((label, i) => (
          <TouchableOpacity
            key={i}
            style={[s.tab, activeTab === i && s.activeTab]}
            onPress={() => setActiveTab(i)}
          >
            <Text style={[s.tabText, activeTab === i && s.activeTabText]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.content}>
        {activeTab === 0 && (
          <View>
            <Text style={s.sectionTitle}>Add New Class</Text>
            <TextInput
              style={s.input}
              placeholder="Subject Name"
              value={subjectName}
              onChangeText={setSubjectName}
            />
            <TextInput
              style={s.input}
              placeholder="Section (e.g. A-101)"
              value={section}
              onChangeText={setSection}
            />
            <TextInput
              style={s.input}
              placeholder="Schedule (e.g. MW 8:00 AM)"
              value={schedule}
              onChangeText={setSchedule}
            />
            <TouchableOpacity style={s.addButton} onPress={addNewClass}>
              <Text style={s.btnText}>ADD CLASS</Text>
            </TouchableOpacity>

            <Text style={s.sectionTitle}>Your Classes ({classes.length})</Text>
            {classes.length === 0 && (
              <Text style={s.emptyText}>No classes yet.</Text>
            )}
            {classes.map((cls) => (
              <View key={cls.id} style={s.classCard}>
                <Text style={s.classTitle}>{cls.subject_name}</Text>
                <Text style={s.classInfo}>Section: {cls.section}</Text>
                {cls.schedule ? (
                  <Text style={s.classInfo}>Schedule: {cls.schedule}</Text>
                ) : null}
                <View style={s.classActions}>
                  <TouchableOpacity
                    style={s.studentsBtn}
                    onPress={() => {
                      setCurrentClassId(cls.id);
                      setCurrentClassName(
                        `${cls.subject_name} – ${cls.section}`,
                      );
                      setShowStudentsModal(true);
                      loadStudents(cls.id, true);
                      loadClassOverviewData(cls.id);
                    }}
                  >
                    <Text style={s.studentsBtnText}>Students</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.deleteBtn}
                    onPress={() =>
                      showAlert("Delete", "Delete this class?", [
                        { text: "Cancel" },
                        { text: "Delete", onPress: () => deleteClass(cls.id) },
                      ])
                    }
                  >
                    <Text style={s.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 1 && (
          <View>
            <Text style={s.sectionTitle}>Select Class</Text>
            <TouchableOpacity
              style={s.picker}
              onPress={() => setShowClassPicker(!showClassPicker)}
            >
              <Text style={s.pickerText}>
                {selectedClassId
                  ? `${selectedClass?.subject_name} – ${selectedClass?.section}`
                  : "-- Select Class --"}
              </Text>
              <Text style={s.pickerArrow}>{showClassPicker ? "▲" : "▼"}</Text>
            </TouchableOpacity>
            {showClassPicker && (
              <View style={s.pickerDropdown}>
                {classes.map((cls) => (
                  <TouchableOpacity
                    key={cls.id}
                    style={s.pickerOption}
                    onPress={() => {
                      setSelectedClassId(cls.id);
                      setShowClassPicker(false);
                      setAttendanceMap({});
                    }}
                  >
                    <Text style={s.pickerOptionText}>
                      {cls.subject_name} – {cls.section}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedClassId && (
              <>
                <TextInput
                  style={s.searchInput}
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {filtered.length === 0 && (
                  <Text style={s.emptyText}>
                    No students yet. Add them in My Classes.
                  </Text>
                )}
                <ScrollView style={s.studentList} nestedScrollEnabled>
                  {filtered.map((student) => (
                    <View key={student.id} style={s.studentRow}>
                      <View style={s.studentInfo}>
                        <Text style={s.studentName}>{student.name}</Text>
                        <Text style={s.studentNumber}>
                          ID: {student.student_number}
                        </Text>
                      </View>
                      <View style={s.attendanceBtns}>
                        {["Present", "Absent", "Late"].map((status) => {
                          const active = attendanceMap[student.id] === status;
                          const colors = {
                            Present: { on: "#16A34A", off: "#E0F2E0" },
                            Absent: { on: "#CC0000", off: "#FEE2E2" },
                            Late: { on: "#D97706", off: "#FEF3C7" },
                          };
                          return (
                            <TouchableOpacity
                              key={status}
                              style={[
                                s.statusBtn,
                                {
                                  backgroundColor: active
                                    ? colors[status].on
                                    : colors[status].off,
                                },
                              ]}
                              onPress={() =>
                                toggleAttendance(student.id, status)
                              }
                            >
                              <Text
                                style={{
                                  color: active ? "#FFF" : "#555",
                                  fontWeight: "bold",
                                  fontSize: 12,
                                }}
                              >
                                {status[0]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={s.saveButton}
                  onPress={saveAttendance}
                  disabled={loading}
                >
                  <Text style={s.saveButtonText}>
                    {loading ? "SAVING..." : "SAVE ATTENDANCE"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showStudentsModal}
        animationType="slide"
        onRequestClose={() => setShowStudentsModal(false)}
      >
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>{currentClassName}</Text>
              <Text style={s.modalSubtitle}>
                {classes.find((c) => c.id === currentClassId)?.schedule ||
                  "No schedule set"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowStudentsModal(false)}
              style={s.closeBtn}
            >
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalContent}>
            <Text style={s.classOverviewHeading}>Class Overview</Text>
            <View style={s.summaryRow}>
              {[
                {
                  label: "Present",
                  value: classSummary.present,
                  color: "#16A34A",
                },
                {
                  label: "Absent",
                  value: classSummary.absent,
                  color: "#CC0000",
                },
                { label: "Late", value: classSummary.late, color: "#D97706" },
                {
                  label: "Rate",
                  value: `${classSummary.rate}%`,
                  color: "#1D4ED8",
                },
              ].map((item) => (
                <View key={item.label} style={s.summaryCard}>
                  <Text style={[s.summaryCount, { color: item.color }]}>
                    {item.value}
                  </Text>
                  <Text style={s.summaryLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <Text style={s.sectionTitle}>Add New Student</Text>
            <TextInput
              style={s.input}
              placeholder="Student Name"
              value={studentName}
              onChangeText={setStudentName}
            />
            <TextInput
              style={s.input}
              placeholder="Student ID Number"
              value={studentNumber}
              onChangeText={setStudentNumber}
              keyboardType="numeric"
            />
            <TouchableOpacity style={s.addButton} onPress={addStudent}>
              <Text style={s.btnText}>ADD STUDENT</Text>
            </TouchableOpacity>

            <Text style={s.sectionTitle}>
              Students ({modalStudents.length})
            </Text>
            {modalStudents.length === 0 && (
              <Text style={s.emptyText}>No students yet.</Text>
            )}
            {modalStudents.map((student) => {
              const sum = studentAttendanceSummary[student.id] || {
                present: 0,
                absent: 0,
                late: 0,
                records: [],
              };
              return (
                <View key={student.id} style={s.studentCard}>
                  <View style={s.studentInfo}>
                    <Text style={s.studentName}>{student.name}</Text>
                    <Text style={s.studentId}>
                      ID: {student.student_number}
                    </Text>
                    <View style={s.totalsRow}>
                      <Text style={[s.total, { color: "#16A34A" }]}>
                        P: {sum.present}
                      </Text>
                      <Text style={[s.total, { color: "#CC0000" }]}>
                        A: {sum.absent}
                      </Text>
                      <Text style={[s.total, { color: "#D97706" }]}>
                        L: {sum.late}
                      </Text>
                    </View>
                    <Text style={s.history}>
                      {sum.records.length > 0
                        ? sum.records
                            .slice(0, 3)
                            .map(
                              (r, i) =>
                                `${r.date} ${r.status}${i < Math.min(sum.records.length, 3) - 1 ? " · " : ""}`,
                            )
                            .join("")
                        : "No attendance records yet."}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.removeBtn}
                    onPress={() =>
                      showAlert("Delete", "Remove this student?", [
                        { text: "Cancel" },
                        {
                          text: "Remove",
                          onPress: () => deleteStudent(student.id),
                        },
                      ])
                    }
                  >
                    <Text style={s.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {AlertModal}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  center: { justifyContent: "center", alignItems: "center", padding: 24 },
  header: {
    backgroundColor: "#CC0000",
    paddingTop: 48,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  tabRow: { flexDirection: "row", backgroundColor: "#F5F5F5", padding: 8 },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    marginHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  activeTab: { backgroundColor: "#CC0000", borderColor: "#CC0000" },
  tabText: { color: "#CC0000", fontWeight: "bold", fontSize: 12 },
  activeTabText: { color: "#FFF" },
  content: { flex: 1, padding: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#CC0000",
    marginVertical: 12,
  },
  input: {
    backgroundColor: "#F5F5F5",
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: "#CC0000",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 12,
  },
  btnText: { color: "#FFF", fontWeight: "bold" },
  emptyText: { textAlign: "center", color: "#777", marginVertical: 16 },
  classCard: {
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  classTitle: { fontSize: 16, fontWeight: "bold" },
  classInfo: { fontSize: 13, color: "#555", marginTop: 4 },
  classActions: { flexDirection: "row", marginTop: 12, gap: 8 },
  studentsBtn: {
    backgroundColor: "#1A3A8F",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  studentsBtnText: { color: "#FFF", textAlign: "center" },
  deleteBtn: {
    backgroundColor: "#CC0000",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  deleteBtnText: { color: "#FFF", textAlign: "center" },
  picker: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    marginBottom: 8,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerText: { fontSize: 15, color: "#333" },
  pickerArrow: { fontSize: 16, color: "#666" },
  pickerDropdown: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  pickerOption: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  pickerOptionText: { fontSize: 15, color: "#333" },
  searchInput: {
    backgroundColor: "#F5F5F5",
    padding: 14,
    borderRadius: 8,
    marginVertical: 8,
  },
  studentList: { maxHeight: 400 },
  studentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  studentInfo: { flex: 1, marginRight: 12 },
  studentName: { fontSize: 15, fontWeight: "600" },
  studentNumber: { fontSize: 13, color: "#666" },
  attendanceBtns: { flexDirection: "row", gap: 6 },
  statusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#CC0000",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  saveButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  modalContainer: { flex: 1, backgroundColor: "#FFF" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#CC0000",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#FFF" },
  modalSubtitle: { color: "#FFF", fontSize: 12, marginTop: 4 },
  closeBtn: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: { fontSize: 18, color: "#FFF" },
  modalContent: { flex: 1, padding: 16 },
  classOverviewHeading: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#CC0000",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  summaryCard: {
    width: "48%",
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  summaryCount: { fontSize: 24, fontWeight: "bold" },
  summaryLabel: { fontSize: 12, color: "#555", marginTop: 6 },
  studentCard: {
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  studentId: { fontSize: 14, color: "#666", marginTop: 4 },
  totalsRow: { flexDirection: "row", marginTop: 8, flexWrap: "wrap" },
  total: { fontSize: 13, fontWeight: "bold", marginRight: 16 },
  history: { marginTop: 8, fontSize: 12, color: "#555" },
  removeBtn: {
    backgroundColor: "#CC0000",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeBtnText: { color: "#FFF", fontSize: 12 },
});
