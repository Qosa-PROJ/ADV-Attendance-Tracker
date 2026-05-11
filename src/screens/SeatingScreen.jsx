import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../FireBase/FireBaseConfig";

const COLS = 5;

export default function SeatingScreen() {
  const [currentUser, setCurrentUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [students, setStudents] = useState([]);
  const [seatMap, setSeatMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [movingSeat, setMovingSeat] = useState(null);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Date and attendance states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState({});
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(COLS);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) loadClasses();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (selectedClassId) loadClassData(selectedClassId);
  }, [selectedClassId]);

  const loadAttendanceData = async (classId, date) => {
    try {
      const dateStr = date.toISOString().split("T")[0];
      const q = query(
        collection(db, "attendance"),
        where("classId", "==", classId),
        where("date", "==", dateStr),
      );
      const snapshot = await getDocs(q);
      const attendance = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        attendance[data.studentId] = data.status.toLowerCase();
      });
      setAttendanceData(attendance);
    } catch (e) {
      console.error("Error loading attendance:", e);
      setAttendanceData({});
    }
  };

  const loadClasses = async () => {
    try {
      const user = currentUser || auth.currentUser;
      if (!user) {
        console.log("No user logged in");
        return;
      }
      const snap = await getDocs(
        query(collection(db, "classes"), where("teacherId", "==", user.uid)),
      );
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error loading classes:", e);
      Alert.alert("Error", "Failed to load classes");
    }
  };

  const loadClassData = async (classId) => {
    setLoading(true);
    try {
      console.log("Loading students for class:", classId);
      const studentSnap = await getDocs(
        query(collection(db, "students"), where("classId", "==", classId)),
      );
      setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      console.log("Loaded students:", studentSnap.docs.length);

      console.log("Loading class doc for seating data:", classId);
      const classDoc = await getDoc(doc(db, "classes", classId));
      if (classDoc.exists()) {
        const data = classDoc.data();
        setSeatMap(data.seatMap || {});
        setRows(data.rows || 4);
        setCols(data.cols || COLS);
        console.log("Seating data loaded from class doc");
      } else {
        setSeatMap({});
        setRows(4);
        setCols(COLS);
        console.log("No class document found for seating data");
      }

      // Load attendance data for current date
      await loadAttendanceData(classId, currentDate);
    } catch (e) {
      console.error("Error loading class data:", e);
      Alert.alert("Error", "Failed to load class data: " + e.message);
    }
    setLoading(false);
  };

  const saveSeating = async () => {
    if (!selectedClassId) return;
    const user = currentUser || auth.currentUser;
    if (!user) {
      Alert.alert("Error", "You must be logged in to save seating.");
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, "classes", selectedClassId),
        {
          seatMap,
          rows,
          cols,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      Alert.alert("Saved", "Seating arrangement saved!");
    } catch (e) {
      console.error("Error saving seating:", e);
      Alert.alert("Error", "Failed to save seating: " + e.message);
    }
    setSaving(false);
  };

  const autoArrange = () => {
    Alert.alert("Auto Arrange", "Randomly assign all students to seats?", [
      { text: "Cancel" },
      {
        text: "Arrange",
        onPress: () => {
          const shuffled = [...students].sort(() => Math.random() - 0.5);
          const newMap = {};
          shuffled.forEach((student, i) => {
            newMap[`${Math.floor(i / COLS)}-${i % COLS}`] = student.id;
          });
          setSeatMap(newMap);
        },
      },
    ]);
  };

  const handleSeatPress = (row, col) => {
    if (isAisleCell(row, col)) return;
    if (movingSeat) {
      moveSeat(row, col);
      return;
    }
    setSelectedSeat({ row, col });
    setSearchQuery("");
    setAssignModal(true);
  };

  const assignStudent = (studentId) => {
    if (!selectedSeat) return;
    const key = `${selectedSeat.row}-${selectedSeat.col}`;
    const newMap = Object.fromEntries(
      Object.entries(seatMap).filter(([, v]) => v !== studentId),
    );
    newMap[key] = studentId;
    setSeatMap(newMap);
    setAssignModal(false);
  };

  const handleAddLayout = () => {
    Alert.alert("Add layout", "Add a row or column?", [
      { text: "Cancel", style: "cancel" },
      { text: "Add Row", onPress: addRow },
      { text: "Add Column", onPress: addColumn },
    ]);
  };

  const handleRemoveLayout = () => {
    Alert.alert("Remove layout", "Remove a row or column?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove Row", onPress: removeRow },
      { text: "Remove Column", onPress: removeColumn },
    ]);
  };

  const removeRow = () => {
    if (rows <= 1) {
      Alert.alert("Cannot remove", "At least one row must remain.");
      return;
    }
    const newMap = { ...seatMap };
    const removedRow = rows - 1;
    for (let c = 0; c < cols; c += 1) {
      delete newMap[`${removedRow}-${c}`];
    }
    setRows(rows - 1);
    setSeatMap(newMap);
  };

  const removeColumn = () => {
    if (cols <= 1) {
      Alert.alert("Cannot remove", "At least one column must remain.");
      return;
    }
    const newMap = { ...seatMap };
    const removedCol = cols - 1;
    for (let r = 0; r < rows; r += 1) {
      delete newMap[`${r}-${removedCol}`];
    }
    setCols(cols - 1);
    setSeatMap(newMap);
  };

  const startMoveMode = (row, col) => {
    const studentId = seatMap[`${row}-${col}`];
    if (!studentId) return;
    setMovingSeat({ row, col, studentId });
  };

  const moveSeat = (row, col) => {
    if (!movingSeat) return;
    const sourceKey = `${movingSeat.row}-${movingSeat.col}`;
    const targetKey = `${row}-${col}`;
    if (sourceKey === targetKey) {
      setMovingSeat(null);
      return;
    }
    const newMap = { ...seatMap };
    const targetStudent = newMap[targetKey];
    delete newMap[sourceKey];
    if (targetStudent) newMap[sourceKey] = targetStudent;
    newMap[targetKey] = movingSeat.studentId;
    setSeatMap(newMap);
    const movedName = getStudentName(movingSeat.studentId);
    setMovingSeat(null);
    Alert.alert("Seat moved", `${movedName} has been moved.`);
  };

  const removeSeat = (row, col) => {
    const newMap = { ...seatMap };
    delete newMap[`${row}-${col}`];
    setSeatMap(newMap);
  };

  const addRow = () => {
    setRows(rows + 1);
  };

  const addColumn = () => {
    setCols(cols + 1);
  };

  const isAisleCell = (row, col) => col === Math.floor(cols / 2);

  const changeDate = (days) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
    if (selectedClassId) {
      loadAttendanceData(selectedClassId, newDate);
    }
  };

  const getStudentName = (id) =>
    students.find((s) => s.id === id)?.name || null;
  const getInitials = (name) =>
    name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : "";

  const seatedIds = new Set(Object.values(seatMap));
  const unseatedStudents = students.filter((s) => !seatedIds.has(s.id));
  const filteredStudents = students.filter(
    (s) =>
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_number?.includes(searchQuery),
  );
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>Seating Arrangement</Text>
            <Text style={styles.headerSub}>Classroom seating layout</Text>
          </View>
          <TouchableOpacity style={styles.datePicker} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.datePickerText}>
              {currentDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
            <Text style={styles.datePickerIcon}>📅</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.pickerContainer, styles.pickerContainerHeader]}
          onPress={() => setShowPicker(!showPicker)}
        >
          <Text style={styles.pickerText}>
            {selectedClassId
              ? `${selectedClass?.subject_name} – ${selectedClass?.section}`
              : "-- Select Class --"}
          </Text>
          <Text style={styles.pickerArrow}>{showPicker ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {showPicker && (
          <View style={styles.pickerDropdown}>
            {classes.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                style={styles.pickerOption}
                onPress={() => {
                  setSelectedClassId(cls.id);
                  setShowPicker(false);
                }}
              >
                <Text style={styles.pickerOptionText}>
                  {cls.subject_name} – {cls.section}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading && (
          <ActivityIndicator color="#CC0000" style={{ marginVertical: 20 }} />
        )}

        {selectedClassId && !loading && (
          <>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={autoArrange}>
                <Text style={styles.actionBtnText}>Auto Arrange</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleAddLayout}>
                <Text style={styles.actionBtnText}>+ Add</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleRemoveLayout}>
                <Text style={styles.actionBtnText}>- Remove</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnOutline]}
                onPress={() =>
                  Alert.alert("Clear", "Clear all seats?", [
                    { text: "Cancel" },
                    { text: "Clear", onPress: () => setSeatMap({}) },
                  ])
                }
              >
                <Text style={[styles.actionBtnText, { color: "#CC0000" }]}> 
                  Clear All
                </Text>
              </TouchableOpacity>
            </View>
            {movingSeat && (
              <View style={styles.moveBanner}>
                <Text style={styles.moveBannerText}>
                  Moving {getStudentName(movingSeat.studentId)} — tap destination seat
                </Text>
                <TouchableOpacity onPress={() => setMovingSeat(null)}>
                  <Text style={styles.moveCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#1A3A8F" }]}
                />
                <Text style={styles.legendText}>Occupied</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#E5E7EB" }]}
                />
                <Text style={styles.legendText}>Empty (tap to assign)</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#22C55E" }]}
                />
                <Text style={styles.legendText}>Present</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#EF4444" }]}
                />
                <Text style={styles.legendText}>Absent</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#F97316" }]}
                />
                <Text style={styles.legendText}>Late</Text>
              </View>
            </View>

            <View style={styles.teacherDesk}>
              <Text style={styles.teacherText}>TEACHER'S DESK</Text>
            </View>

            <View style={styles.grid}>
              {Array.from({ length: rows }).map((_, row) => (
                <View key={row} style={styles.gridRow}>
                  {Array.from({ length: cols }).map((_, col) => {
                    const aisle = isAisleCell(row, col);
                    if (aisle) {
                      return (
                        <View key={col} style={[styles.seat, styles.aisleCell]} />
                      );
                    }
                    const studentId = seatMap[`${row}-${col}`];
                    const name = getStudentName(studentId);
                    const attendanceStatus = studentId ? attendanceData[studentId] : null;
                    const isSelectedMoveSource =
                      movingSeat && movingSeat.row === row && movingSeat.col === col;
                    let seatStyle = [styles.seat, name ? styles.seatOccupied : styles.seatEmpty];
                    if (name && attendanceStatus) {
                      if (attendanceStatus === "present") {
                        seatStyle = [styles.seat, { backgroundColor: "#22C55E" }];
                      } else if (attendanceStatus === "absent") {
                        seatStyle = [styles.seat, { backgroundColor: "#EF4444" }];
                      } else if (attendanceStatus === "late") {
                        seatStyle = [styles.seat, { backgroundColor: "#F97316" }];
                      }
                    }
                    if (isSelectedMoveSource) {
                      seatStyle.push(styles.seatSelected);
                    }
                    return (
                      <TouchableOpacity
                        key={col}
                        style={seatStyle}
                        onPress={() => handleSeatPress(row, col)}
                        onLongPress={() => {
                          if (name)
                            Alert.alert(name, "Choose an action", [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Move",
                                onPress: () => startMoveMode(row, col),
                              },
                              {
                                text: "Remove",
                                onPress: () => removeSeat(row, col),
                                style: "destructive",
                              },
                            ]);
                        }}
                      >
                        {name ? (
                          <>
                            <Text style={styles.seatInitials}>
                              {getInitials(name)}
                            </Text>
                            <Text style={styles.seatName} numberOfLines={2}>
                              {name.split(" ")[0]}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.seatEmptyText}>EMPTY</Text>
                        )}
                      </TouchableOpacity>
                    );

                  })}
                </View>
              ))}
            </View>

            {unseatedStudents.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  Unseated ({unseatedStudents.length})
                </Text>
                <View style={styles.unseatedList}>
                  {unseatedStudents.map((s) => (
                    <View key={s.id} style={styles.unseatedChip}>
                      <Text style={styles.unseatedName}>{s.name}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveSeating}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? "SAVING..." : "SAVE SEATING ARRANGEMENT"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Assign Modal */}
      <Modal
        visible={assignModal}
        animationType="slide"
        transparent
        onRequestClose={() => setAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Assign Seat{" "}
                {selectedSeat
                  ? `(R${selectedSeat.row + 1} C${selectedSeat.col + 1})`
                  : ""}
              </Text>
              <TouchableOpacity onPress={() => setAssignModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search student..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />

            {selectedSeat &&
              seatMap[`${selectedSeat.row}-${selectedSeat.col}`] && (
                <TouchableOpacity
                  style={styles.clearSeatBtn}
                  onPress={() => {
                    removeSeat(selectedSeat.row, selectedSeat.col);
                    setAssignModal(false);
                  }}
                >
                  <Text style={styles.clearSeatText}>🗑 Clear this seat</Text>
                </TouchableOpacity>
              )}

            <ScrollView style={{ maxHeight: 320 }}>
              {filteredStudents.map((s) => {
                const isSeated = seatedIds.has(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.studentOption,
                      isSeated && styles.studentOptionSeated,
                    ]}
                    onPress={() => assignStudent(s.id)}
                  >
                    <View style={styles.studentOptionAvatar}>
                      <Text style={styles.studentOptionInitials}>
                        {getInitials(s.name)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.studentOptionName}>{s.name}</Text>
                      <Text style={styles.studentOptionId}>
                        #{s.student_number}
                        {isSeated ? " · already seated" : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display={Platform.OS === "android" ? "calendar" : "default"}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setCurrentDate(selectedDate);
              if (selectedClassId) {
                loadAttendanceData(selectedClassId, selectedDate);
              }
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { backgroundColor: "#CC0000", padding: 20, paddingTop: 48 },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  headerSub: { color: "#FFCCCC", fontSize: 13, marginTop: 4 },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#CC0000",
    marginVertical: 12,
  },
  pickerContainer: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  pickerContainerHeader: {
    backgroundColor: "#FFFFFF",
    marginTop: 12,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  datePicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  datePickerText: {
    color: "#FFCCCC",
    fontSize: 13,
  },
  datePickerIcon: {
    marginLeft: 6,
    fontSize: 16,
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
  actionRow: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  actionBtn: {
    minWidth: 100,
    backgroundColor: "#1A3A8F",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionBtnOutline: {
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#CC0000",
  },
  actionBtnText: { color: "#FFF", fontWeight: "bold" },
  legend: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
    justifyContent: "center",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: "#555" },
  teacherDesk: {
    width: "80%",
    alignSelf: "center",
    height: 52,
    backgroundColor: "#1A3A8F",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 20,
  },
  teacherText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  grid: { alignItems: "center", marginBottom: 16 },
  gridRow: { flexDirection: "row", marginBottom: 8 },
  seat: {
    width: 58,
    height: 64,
    marginHorizontal: 3,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
  },
  seatEmpty: {
    backgroundColor: "#E5E7EB",
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
  },
  seatOccupied: { backgroundColor: "#1A3A8F" },
  seatInitials: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
  seatName: {
    color: "#CBD5E1",
    fontSize: 9,
    textAlign: "center",
    marginTop: 2,
  },
  seatEmptyText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  seatPlus: { color: "#9CA3AF", fontSize: 22, fontWeight: "300" },
  addButton: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: { color: "#1F2937", fontSize: 18, fontWeight: "bold" },
  addButtonLabel: { color: "#475569", fontSize: 10, marginTop: 4 },
  aisleCell: {
    backgroundColor: "#FFFFFF",
    borderWidth: 0,
    marginHorizontal: 3,
    width: 58,
    height: 64,
  },
  unseatedList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  unseatedChip: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  unseatedName: { color: "#CC0000", fontSize: 13 },
  saveButton: {
    backgroundColor: "#CC0000",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  saveButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  modalClose: { fontSize: 20, color: "#666", padding: 4 },
  searchInput: {
    backgroundColor: "#F5F5F5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  clearSeatBtn: {
    backgroundColor: "#FEF2F2",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  clearSeatText: { color: "#CC0000", fontWeight: "bold" },
  studentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  studentOptionSeated: { backgroundColor: "#F0F4FF" },
  studentOptionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A3A8F",
    justifyContent: "center",
    alignItems: "center",
  },
  studentOptionInitials: { color: "#FFF", fontWeight: "bold" },
  studentOptionName: { fontSize: 15, fontWeight: "600" },
  studentOptionId: { fontSize: 12, color: "#777", marginTop: 2 },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  dateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#CC0000",
    justifyContent: "center",
    alignItems: "center",
  },
  dateButtonText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  dateText: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginHorizontal: 12,
  },
  addButton: {
    backgroundColor: "#E5E7EB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
  },
  addButtonText: { color: "#6B7280", fontSize: 20, fontWeight: "bold" },
  seatSelected: {
    borderWidth: 2,
    borderColor: "#2563EB",
  },
  moveBanner: {
    backgroundColor: "#E0F2FE",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  moveBannerText: { color: "#1D4ED8", fontSize: 13, fontWeight: "600" },
  moveCancelText: { color: "#1D4ED8", fontSize: 13, fontWeight: "700" },
});
