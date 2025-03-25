
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { QrCode, Loader } from "lucide-react";

const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsLoading(true);
    try {
      await login(username, password);
      navigate("/products");
    } catch (error) {
      // Error is handled in the auth context
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-secondary/30">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-primary/10">
            <QrCode className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold">LampQR</h2>
          <p className="mt-2 text-muted-foreground">Sign in to manage your lamp products</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            Demo login: Use any username and password (min 6 characters)
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
