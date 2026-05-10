// src/screens/ProfileScreen.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { auth, db } from "../FireBase/FireBaseConfig";
import {
  signOut,
  deleteUser,
  updateProfile,
  updatePassword,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

export default function ProfileScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setEmail(user.email || "");
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      setName(
        userDoc.exists()
          ? userDoc.data().name || user.displayName || ""
          : user.displayName || "",
      );
      setPhotoURL(
        userDoc.exists()
          ? userDoc.data().photoURL || user.photoURL || ""
          : user.photoURL || "",
      );
    } catch {
      setName(user.displayName || "");
      setPhotoURL(user.photoURL || "");
    }
    setFetching(false);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "We need permission to access your photos to change your profile picture.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      const uri = result.assets?.[0]?.uri || result.uri;
      if (uri) {
        setPhotoURL(uri);
      }
    }
  };

  const handleSaveChanges = async () => {
    const user = auth.currentUser;
    if (!user) return;
    if (!name.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Error", "Email cannot be empty");
      return;
    }
    const emailChanged =
      email.trim().toLowerCase() !== (user.email || "").toLowerCase();
    const passwordChanged = newPassword.length > 0;
    const photoChanged = photoURL.trim() !== (user.photoURL || "");
    if (passwordChanged && newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters");
      return;
    }
    if ((passwordChanged || emailChanged || photoChanged) && !currentPassword) {
      Alert.alert(
        "Error",
        "Enter your current password to change email, password, or profile picture",
      );
      return;
    }

    setLoading(true);
    try {
      if (passwordChanged || emailChanged || photoChanged) {
        const credential = EmailAuthProvider.credential(
          user.email,
          currentPassword,
        );
        await reauthenticateWithCredential(user, credential);
      }

      if (name.trim() !== user.displayName || photoChanged) {
        await updateProfile(user, {
          displayName: name.trim(),
          photoURL: photoURL.trim() || user.photoURL || null,
        });
      }

      if (emailChanged) {
        await updateEmail(user, email.trim());
      }

      if (passwordChanged) {
        await updatePassword(user, newPassword);
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          name: name.trim(),
          email: email.trim(),
          photoURL: photoURL.trim(),
        },
        { merge: true },
      );

      setCurrentPassword("");
      setNewPassword("");
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      let message = error.message;
      if (error.code === "auth/wrong-password")
        message = "Current password is incorrect";
      else if (error.code === "auth/weak-password")
        message = "New password is too weak";
      else if (error.code === "auth/requires-recent-login")
        message = "Please enter your current password to make this change";
      Alert.alert("Error", message);
    }
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;
    if (!currentPassword) {
      Alert.alert(
        "Error",
        "Enter your current password to delete your account.",
      );
      return;
    }

    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your personal information. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const credential = EmailAuthProvider.credential(
                user.email,
                currentPassword,
              );
              await reauthenticateWithCredential(user, credential);

              const uid = user.uid;
              await deleteDoc(doc(db, "users", uid));

              const classSnap = await getDocs(
                query(collection(db, "classes"), where("teacherId", "==", uid)),
              );
              const classIds = classSnap.docs.map((d) => d.id);

              await Promise.all(
                classIds.map((classId) =>
                  deleteDoc(doc(db, "classes", classId)),
                ),
              );

              for (let i = 0; i < classIds.length; i += 10) {
                const chunk = classIds.slice(i, i + 10);
                const studentSnap = await getDocs(
                  query(
                    collection(db, "students"),
                    where("classId", "in", chunk),
                  ),
                );
                await Promise.all(
                  studentSnap.docs.map((d) =>
                    deleteDoc(doc(db, "students", d.id)),
                  ),
                );
              }

              for (let i = 0; i < classIds.length; i += 10) {
                const chunk = classIds.slice(i, i + 10);
                const attSnap = await getDocs(
                  query(
                    collection(db, "attendance"),
                    where("classId", "in", chunk),
                  ),
                );
                await Promise.all(
                  attSnap.docs.map((d) =>
                    deleteDoc(doc(db, "attendance", d.id)),
                  ),
                );
              }

              await deleteUser(user);
              Alert.alert("Success", "Your account has been deleted.");
            } catch (error) {
              let message = error.message;
              if (error.code === "auth/wrong-password")
                message = "Current password is incorrect";
              else if (error.code === "auth/requires-recent-login")
                message =
                  "Please re-open the app and try again to delete your account.";
              Alert.alert("Error", message);
            }
            setLoading(false);
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
          } catch {
            Alert.alert("Error", "Failed to log out");
          }
        },
      },
    ]);
  };

  const getInitials = (n) =>
    n
      ? n
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : "T";

  if (fetching) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator color="#CC0000" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.avatarWrapper} onPress={pickImage}>
          <View style={styles.avatarCircle}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
            )}
          </View>
          <Text style={styles.editAvatarText}>Change</Text>
        </TouchableOpacity>
        <Text style={styles.nameText}>{name || "Teacher"}</Text>
        <Text style={styles.emailHeader}>{email}</Text>
        <Text style={styles.role}>Teacher</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Edit Profile</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter your full name"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.hint}>
          Change your email address here. Enter current password below when
          saving.
        </Text>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
          Change Password
        </Text>
        <Text style={styles.hint}>
          Leave blank to keep your current password.
        </Text>

        <Text style={styles.label}>Current Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter current password"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />

        <Text style={styles.label}>New Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Min 6 characters"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />

        <TouchableOpacity
          style={[styles.saveButton, loading && { opacity: 0.6 }]}
          onPress={handleSaveChanges}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteAccount}
          disabled={loading}
        >
          <Text style={styles.deleteButtonText}>DELETE ACCOUNT</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    backgroundColor: "#CC0000",
    padding: 20,
    paddingTop: 48,
    alignItems: "center",
  },
  avatarWrapper: { alignItems: "center", marginBottom: 10 },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarInitials: { color: "#FFF", fontSize: 28, fontWeight: "bold" },
  editAvatarText: { color: "#FFF", fontSize: 12, marginTop: 6 },
  nameText: { color: "#FFF", fontSize: 20, fontWeight: "bold" },
  emailHeader: { color: "#FFCCCC", fontSize: 13, marginTop: 2 },
  role: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 },
  content: { flex: 1, padding: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#CC0000",
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: "#CC0000",
    fontWeight: "bold",
    marginBottom: 4,
  },
  hint: { fontSize: 11, color: "#999", marginBottom: 12, marginTop: -8 },
  input: {
    backgroundColor: "#F5F5F5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  inputDisabled: { color: "#999", marginBottom: 4 },
  saveButton: {
    backgroundColor: "#1A3A8F",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  saveButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  deleteButton: {
    backgroundColor: "#8B0000",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  deleteButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  logoutButton: {
    backgroundColor: "#CC0000",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  logoutText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
});
