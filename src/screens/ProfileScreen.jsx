import React, { useState, useEffect } from "react";
import useWebAlert from "../components/WebAlertModal";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
} from "react-native";
import { auth, db } from "../FireBase/FireBaseConfig";
import {
  signOut,
  deleteUser,
  updateProfile,
  updatePassword,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  onAuthStateChanged,
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

let ImagePicker;
if (typeof document !== "undefined") {
  ImagePicker = require("expo-image-picker");
}

export default function ProfileScreen({ onSignOut }) {
  const { showAlert, AlertModal } = useWebAlert();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadProfile();
      } else {
        setFetching(false);
      }
    });
    return unsubscribe;
  }, []);

  const loadProfile = async () => {
    const user = auth.currentUser;
    if (!user) {
      setFetching(false);
      return;
    }

    try {
      await user.reload();
    } catch (e) {
      console.warn(e);
    }

    setEmail(user.email || "");

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setName(data.name || user.displayName || "");
        setPhotoURL(data.photoURL || user.photoURL || "");
      } else {
        setName(user.displayName || "");
        setPhotoURL(user.photoURL || "");
      }
    } catch (err) {
      console.error(err);
      setName(user.displayName || "");
      setPhotoURL(user.photoURL || "");
    }

    setFetching(false);
  };

  const pickImage = async () => {
    if (!ImagePicker) {
      showAlert("Not supported", "Image picker is not available on web");
      return;
    }
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showAlert(
          "Permission required",
          "We need permission to access your photos.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled) {
        const asset = result.assets?.[0] || result;
        const base64 = asset?.base64;
        if (base64) {
          await saveProfilePhoto(base64);
        } else {
          showAlert("Error", "Could not read image data.");
        }
      }
    } catch (error) {
      showAlert("Error", "Failed to pick image: " + error.message);
    }
  };

  const saveProfilePhoto = async (base64String) => {
    const user = auth.currentUser;
    if (!user || !base64String) return;
    setSavingPhoto(true);
    try {
      const dataUri = `data:image/jpeg;base64,${base64String}`;
      const sizeInKB = (base64String.length * 3) / 4 / 1024;
      if (sizeInKB > 900) {
        showAlert(
          "Image too large",
          "Please choose a smaller image or crop it more tightly.",
        );
        setSavingPhoto(false);
        return;
      }
      await setDoc(
        doc(db, "users", user.uid),
        { photoURL: dataUri },
        { merge: true },
      );
      await updateProfile(user, { photoURL: "firestore_photo" });
      setPhotoURL(dataUri);
      showAlert("Success", "Profile photo updated!");
    } catch (error) {
      showAlert("Error", "Unable to save profile photo: " + error.message);
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleSaveChanges = async () => {
    const user = auth.currentUser;
    if (!user) return;
    if (!name.trim()) {
      showAlert("Error", "Name cannot be empty");
      return;
    }
    if (!email.trim()) {
      showAlert("Error", "Email cannot be empty");
      return;
    }

    const emailChanged =
      email.trim().toLowerCase() !== (user.email || "").toLowerCase();
    const passwordChanged = newPassword.length > 0;
    const requiresPassword = emailChanged || passwordChanged;

    if (passwordChanged && newPassword.length < 6) {
      showAlert("Error", "New password must be at least 6 characters");
      return;
    }
    if (requiresPassword && !currentPassword) {
      showAlert(
        "Error",
        "Enter your current password to change email or password",
      );
      return;
    }

    setLoading(true);
    try {
      if (requiresPassword) {
        const credential = EmailAuthProvider.credential(
          user.email,
          currentPassword,
        );
        await reauthenticateWithCredential(user, credential);
      }
      if (name.trim() !== user.displayName) {
        await updateProfile(user, {
          displayName: name.trim(),
          photoURL: user.photoURL || null,
        });
      }
      if (emailChanged) await updateEmail(user, email.trim());
      if (passwordChanged) await updatePassword(user, newPassword);

      await setDoc(
        doc(db, "users", user.uid),
        { name: name.trim(), email: email.trim() },
        { merge: true },
      );

      setCurrentPassword("");
      setNewPassword("");
      showAlert("Success", "Profile updated successfully!");
    } catch (error) {
      let message = error.message;
      if (error.code === "auth/wrong-password")
        message = "Current password is incorrect";
      else if (error.code === "auth/weak-password")
        message = "New password is too weak";
      else if (error.code === "auth/requires-recent-login")
        message = "Please enter your current password to make this change";
      showAlert("Error", message);
    }
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;
    if (!currentPassword) {
      showAlert("Error", "Enter your current password to delete your account.");
      return;
    }

    const doDelete = async () => {
      setLoading(true);
      try {
        const credential = EmailAuthProvider.credential(
          user.email,
          currentPassword,
        );
        await reauthenticateWithCredential(user, credential);

        const classSnap = await getDocs(
          query(collection(db, "classes"), where("teacherId", "==", user.uid)),
        );
        const classIds = classSnap.docs.map((d) => d.id);
        await Promise.all(
          classSnap.docs.map((d) => deleteDoc(doc(db, "classes", d.id))),
        );

        const studentSnap = await getDocs(
          query(collection(db, "students"), where("teacherId", "==", user.uid)),
        );
        await Promise.all(
          studentSnap.docs.map((d) => deleteDoc(doc(db, "students", d.id))),
        );

        for (let i = 0; i < classIds.length; i += 10) {
          const chunk = classIds.slice(i, i + 10);
          const attSnap = await getDocs(
            query(collection(db, "attendance"), where("classId", "in", chunk)),
          );
          await Promise.all(
            attSnap.docs.map((d) => deleteDoc(doc(db, "attendance", d.id))),
          );
        }

        await deleteDoc(doc(db, "users", user.uid));
        await deleteUser(user);
        showAlert("Success", "Your account has been deleted.");
      } catch (error) {
        let message = error.message;
        if (error.code === "auth/wrong-password")
          message = "Current password is incorrect";
        else if (error.code === "auth/requires-recent-login")
          message =
            "Please re-open the app and try again to delete your account.";
        showAlert("Error", message);
      }
      setLoading(false);
    };

    showAlert(
      "Delete Account",
      "This will permanently delete your account and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ],
    );
  };

  const handleLogout = async () => {
    const doSignOut = async () => {
      try {
        await signOut(auth);
        if (onSignOut) onSignOut();
      } catch {
        showAlert("Error", "Failed to log out");
      }
    };

    showAlert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: doSignOut },
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
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={pickImage}
          disabled={savingPhoto}
        >
          <View style={styles.avatarCircle}>
            {photoURL ? (
              <Image
                key={photoURL.slice(0, 50)}
                source={{ uri: photoURL }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
            )}
          </View>
          {savingPhoto ? (
            <ActivityIndicator
              color="#FFF"
              size="small"
              style={{ marginTop: 6 }}
            />
          ) : (
            <Text style={styles.editAvatarText}>Change</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.nameText}>{name || "Teacher"}</Text>
        <Text style={styles.emailHeader}>{email}</Text>
        <Text style={styles.role}>Teacher</Text>
        {savingPhoto && (
          <View style={styles.savingPhotoRow}>
            <Text style={styles.savingPhotoText}>Saving profile photo...</Text>
          </View>
        )}
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
        <View style={styles.passwordInputWrapper}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Enter current password"
            secureTextEntry={!showCurrentPassword}
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={() => setShowCurrentPassword(!showCurrentPassword)}
          >
            <Image
              source={
                showCurrentPassword
                  ? require("../../assets/hide-password.png")
                  : require("../../assets/view-password.png")
              }
              style={styles.passwordIcon}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>New Password</Text>
        <View style={styles.passwordInputWrapper}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Min 6 characters"
            secureTextEntry={!showNewPassword}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={() => setShowNewPassword(!showNewPassword)}
          >
            <Image
              source={
                showNewPassword
                  ? require("../../assets/hide-password.png")
                  : require("../../assets/view-password.png")
              }
              style={styles.passwordIcon}
            />
          </TouchableOpacity>
        </View>

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

      {AlertModal}
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
  passwordInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    marginBottom: 16,
    paddingRight: 8,
  },
  passwordInput: { flex: 1, padding: 12, fontSize: 14 },
  passwordToggle: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  passwordIcon: { width: 20, height: 20 },
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
  savingPhotoRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  savingPhotoText: { color: "#FFF", fontSize: 12 },
});
