import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from "react-native";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../FireBase/FireBaseConfig";
import { setIsRegistering } from "../navigation/AppNavigator";
import useWebAlert from "../components/WebAlertModal";

export default function RegisterScreen({ navigation, onRegistered }) {
  const { showAlert, AlertModal } = useWebAlert();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const register = async () => {
    if (!name || !email || !password || !confirm) {
      showAlert("Error", "All fields are required");
      return;
    }
    if (password !== confirm) {
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
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        email,
        createdAt: new Date().toISOString(),
      });
      await signOut(auth);
      onRegistered();
      showAlert("Success", "Account created! Please log in.", [{ text: "OK" }]);
    } catch (err) {
      setIsRegistering(false);
      showAlert("Registration Failed", err.message);
    }
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.title}>Create Account</Text>
      <Text style={s.subtitle}>Register to get started</Text>

      <Text style={s.label}>Full Name</Text>
      <TextInput
        style={s.input}
        placeholder="Enter your full name"
        value={name}
        onChangeText={setName}
      />

      <Text style={s.label}>Email</Text>
      <TextInput
        style={s.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={s.label}>Password</Text>
      <View style={s.passRow}>
        <TextInput
          style={s.passInput}
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPass}
        />
        <TouchableOpacity
          style={s.passToggle}
          onPress={() => setShowPass(!showPass)}
        >
          <Image
            source={
              showPass
                ? require("../../assets/hide-password.png")
                : require("../../assets/view-password.png")
            }
            style={s.passIcon}
          />
        </TouchableOpacity>
      </View>

      <Text style={s.label}>Confirm Password</Text>
      <View style={s.passRow}>
        <TextInput
          style={s.passInput}
          placeholder="Re-enter your password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry={!showConfirm}
        />
        <TouchableOpacity
          style={s.passToggle}
          onPress={() => setShowConfirm(!showConfirm)}
        >
          <Image
            source={
              showConfirm
                ? require("../../assets/hide-password.png")
                : require("../../assets/view-password.png")
            }
            style={s.passIcon}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.button} onPress={register} disabled={loading}>
        <Text style={s.buttonText}>
          {loading ? "CREATING ACCOUNT..." : "REGISTER"}
        </Text>
      </TouchableOpacity>

      <View style={s.footer}>
        <Text>Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.link}>Sign In</Text>
        </TouchableOpacity>
      </View>

      {AlertModal}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#FFF",
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
  passRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    marginBottom: 16,
    paddingRight: 8,
  },
  passInput: { flex: 1, padding: 14, fontSize: 14 },
  passToggle: { padding: 8 },
  passIcon: { width: 20, height: 20 },
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
