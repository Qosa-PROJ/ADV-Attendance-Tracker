// src/screens/SeatingScreen.jsx
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
} from "react-native";
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
        setSeatMap(classDoc.data().seatMap || {});
        console.log("Seating data loaded from class doc");
      } else {
        setSeatMap({});
        console.log("No class document found for seating data");
      }
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

  const removeSeat = (row, col) => {
    const newMap = { ...seatMap };
    delete newMap[`${row}-${col}`];
    setSeatMap(newMap);
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

  const rows = selectedClassId
    ? Math.max(4, Math.ceil(students.length / COLS) + 1)
    : 4;
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
        <Text style={styles.headerTitle}>Seating Arrangement</Text>
        {selectedClass && (
          <Text style={styles.headerSub}>
            {selectedClass.subject_name} – {selectedClass.section}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Select Class</Text>
        <TouchableOpacity
          style={styles.pickerContainer}
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

        {loading && (
          <ActivityIndicator color="#CC0000" style={{ marginVertical: 20 }} />
        )}

        {selectedClassId && !loading && (
          <>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={autoArrange}>
                <Text style={styles.actionBtnText}>Auto Arrange</Text>
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
            </View>

            <View style={styles.teacherDesk}>
              <Text style={styles.teacherText}>TEACHER'S DESK</Text>
            </View>

            <View style={styles.grid}>
              {Array.from({ length: rows }).map((_, row) => (
                <View key={row} style={styles.gridRow}>
                  {Array.from({ length: COLS }).map((_, col) => {
                    const name = getStudentName(seatMap[`${row}-${col}`]);
                    return (
                      <TouchableOpacity
                        key={col}
                        style={[
                          styles.seat,
                          name ? styles.seatOccupied : styles.seatEmpty,
                        ]}
                        onPress={() => handleSeatPress(row, col)}
                        onLongPress={() => {
                          if (name)
                            Alert.alert("Remove", `Remove ${name}?`, [
                              { text: "Cancel" },
                              {
                                text: "Remove",
                                onPress: () => removeSeat(row, col),
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
                          <Text style={styles.seatPlus}>+</Text>
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
  actionRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  actionBtn: {
    flex: 1,
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
  seatPlus: { color: "#9CA3AF", fontSize: 22, fontWeight: "300" },
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
});
