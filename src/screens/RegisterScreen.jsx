// src/screens/RegisterScreen.jsx
import { Alert as RNAlert } from "react-native";
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Image,
} from "react-native";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../FireBase/FireBaseConfig";
import { setIsRegistering } from "../navigation/AppNavigator";

const isWeb = typeof document !== "undefined";

// ─── Web-compatible Alert ────────────────────────────────────────────────────
function useWebAlert() {
  const [alertConfig, setAlertConfig] = React.useState(null);

  const showAlert = React.useCallback((title, message, buttons) => {
    if (!isWeb) {
      RNAlert.alert(title, message, buttons);
      return;
    }
    const resolvedButtons =
      buttons && buttons.length > 0
        ? buttons
        : [{ text: "OK", style: "default" }];
    setAlertConfig({ title, message, buttons: resolvedButtons });
  }, []);

  const handlePress = (btn) => {
    setAlertConfig(null);
    if (btn.onPress) btn.onPress();
  };

  const AlertModal = alertConfig ? (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={() => setAlertConfig(null)}
    >
      <View style={alertStyles.overlay}>
        <View style={alertStyles.dialog}>
          {alertConfig.title ? (
            <Text style={alertStyles.title}>{alertConfig.title}</Text>
          ) : null}
          {alertConfig.message ? (
            <Text style={alertStyles.message}>{alertConfig.message}</Text>
          ) : null}
          <View
            style={[
              alertStyles.buttonRow,
              alertConfig.buttons.length > 2 && alertStyles.buttonColumn,
            ]}
          >
            {alertConfig.buttons.map((btn, idx) => {
              const isDestructive = btn.style === "destructive";
              const isCancel = btn.style === "cancel";
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    alertStyles.btn,
                    isDestructive && alertStyles.btnDestructive,
                    isCancel && alertStyles.btnCancel,
                    alertConfig.buttons.length === 1 && alertStyles.btnSingle,
                    alertConfig.buttons.length > 2 && alertStyles.btnFull,
                  ]}
                  onPress={() => handlePress(btn)}
                >
                  <Text
                    style={[
                      alertStyles.btnText,
                      isCancel && alertStyles.btnTextCancel,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  ) : null;

  return { showAlert, AlertModal };
}

const alertStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  dialog: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#444",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  buttonColumn: { flexDirection: "column", gap: 8 },
  btn: {
    flex: 1,
    backgroundColor: "#CC0000",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 9,
    alignItems: "center",
  },
  btnSingle: { flex: 0, paddingHorizontal: 48 },
  btnFull: { flex: 0, width: "100%" },
  btnDestructive: { backgroundColor: "#8B0000" },
  btnCancel: { backgroundColor: "#F0F0F0" },
  btnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  btnTextCancel: { color: "#333" },
});
// ─────────────────────────────────────────────────────────────────────────────

export default function RegisterScreen({ navigation, onRegistered }) {
  const { showAlert, AlertModal } = useWebAlert();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      showAlert("Error", "All fields are required");
      return;
    }
    if (password !== confirmPassword) {
      showAlert("Error", "Passwords do not match");
      return;
    }
    if (password.length < 6) {
      showAlert("Error", "Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      setIsRegistering(true);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      await setDoc(doc(db, "users", userCredential.user.uid), {
        name,
        email,
        createdAt: new Date().toISOString(),
      });

      await signOut(auth);
      onRegistered();

      showAlert(
        "Success",
        "Account created successfully! Please log in with your new account.",
        [{ text: "OK" }],
      );
    } catch (error) {
      setIsRegistering(false);
      showAlert("Registration Failed", error.message);
    }
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Register to get started</Text>

      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your full name"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Password</Text>
      <View style={styles.passwordInputWrapper}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity
          style={styles.passwordToggle}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Image
            source={
              showPassword
                ? require("../../assets/hide-password.png")
                : require("../../assets/view-password.png")
            }
            style={styles.passwordIcon}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Confirm Password</Text>
      <View style={styles.passwordInputWrapper}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
        />
        <TouchableOpacity
          style={styles.passwordToggle}
          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
        >
          <Image
            source={
              showConfirmPassword
                ? require("../../assets/hide-password.png")
                : require("../../assets/view-password.png")
            }
            style={styles.passwordIcon}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "CREATING ACCOUNT..." : "REGISTER"}
        </Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text>Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Sign In</Text>
        </TouchableOpacity>
      </View>

      {AlertModal}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
    padding: 32,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#CC0000",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: "#1A3A8F",
    textAlign: "center",
    marginBottom: 32,
  },
  label: {
    fontSize: 13,
    color: "#CC0000",
    fontWeight: "bold",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#F5F5F5",
    padding: 14,
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
  passwordInput: { flex: 1, padding: 14, fontSize: 14 },
  passwordToggle: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  passwordIcon: { width: 20, height: 20 },
  button: {
    backgroundColor: "#CC0000",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  link: { color: "#1A3A8F", fontWeight: "bold" },
});
