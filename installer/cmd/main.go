// Docker Command Center - Windows Installer
// Installs DCC to Program Files, creates shortcuts, and launches the app.
//
//go:generate goversioninfo -icon=../dcc.ico -manifest=../app.manifest
package main

import (
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

//go:embed dcc.exe
var dccBinary []byte

var (
	kernel32             = syscall.NewLazyDLL("kernel32.dll")
	shell32              = syscall.NewLazyDLL("shell32.dll")
	user32               = syscall.NewLazyDLL("user32.dll")
	procMessageBoxW      = user32.NewProc("MessageBoxW")
	procSHCreateShortcut = shell32.NewProc("SHCreateShortcutEx")
)

const (
	MB_OK               = 0x00000000
	MB_OKCANCEL         = 0x00000001
	MB_YESNO            = 0x00000004
	MB_ICONINFORMATION  = 0x00000040
	MB_ICONERROR        = 0x00000010
	MB_ICONQUESTION     = 0x00000020
	IDOK                = 1
	IDCANCEL            = 2
	IDYES               = 6
	IDNO                = 7
	MB_DEFBUTTON1       = 0x00000000
	appName             = "Docker Command Center"
	appVersion          = "2.3.0"
	appPort             = "9876"
	installSubDir       = "Docker Command Center"
	uninstallRegKey     = `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\DockerCommandCenter`
	startMenuSubDir     = `Microsoft\Windows\Start Menu\Programs\Docker Command Center`
)

func messageBox(title, msg string, flags uint32) int32 {
	titlePtr, _ := syscall.UTF16PtrFromString(title)
	msgPtr, _ := syscall.UTF16PtrFromString(msg)
	ret, _, _ := procMessageBoxW.Call(0, uintptr(unsafe.Pointer(msgPtr)), uintptr(unsafe.Pointer(titlePtr)), uintptr(flags))
	return int32(ret)
}

func getProgramFilesDir() string {
	dir, err := windows.KnownFolderPath(windows.FOLDERID_ProgramFiles, 0)
	if err != nil {
		dir = `C:\Program Files`
	}
	return dir
}

func getCommonStartMenuDir() string {
	dir, err := windows.KnownFolderPath(windows.FOLDERID_CommonPrograms, 0)
	if err != nil {
		dir = filepath.Join(os.Getenv("ALLUSERSPROFILE"), "Microsoft", "Windows", "Start Menu", "Programs")
	}
	return dir
}

func getDesktopDir() string {
	dir, err := windows.KnownFolderPath(windows.FOLDERID_Desktop, 0)
	if err != nil {
		dir = filepath.Join(os.Getenv("USERPROFILE"), "Desktop")
	}
	return dir
}

// createShortcut uses COM (IShellLink) via PowerShell to create a .lnk file.
func createShortcut(lnkPath, target, args, workDir, iconPath, description string) error {
	ps := fmt.Sprintf(`
$ws = New-Object -ComObject WScript.Shell
$s  = $ws.CreateShortcut('%s')
$s.TargetPath       = '%s'
$s.Arguments        = '%s'
$s.WorkingDirectory = '%s'
$s.IconLocation     = '%s'
$s.Description      = '%s'
$s.Save()
`, lnkPath, target, args, workDir, iconPath, description)
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", ps)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Run()
}

func registerUninstall(installDir, exePath string) {
	k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, uninstallRegKey, registry.SET_VALUE)
	if err != nil {
		return
	}
	defer k.Close()
	_ = k.SetStringValue("DisplayName", appName)
	_ = k.SetStringValue("DisplayVersion", appVersion)
	_ = k.SetStringValue("Publisher", "Paul Moore")
	_ = k.SetStringValue("InstallLocation", installDir)
	_ = k.SetStringValue("UninstallString", fmt.Sprintf(`"%s" /uninstall`, exePath))
	_ = k.SetStringValue("DisplayIcon", exePath)
	_ = k.SetDWordValue("NoModify", 1)
	_ = k.SetDWordValue("NoRepair", 1)
}

func isElevated() bool {
	var sid *windows.SID
	_ = windows.AllocateAndInitializeSid(&windows.SECURITY_NT_AUTHORITY, 2,
		windows.SECURITY_BUILTIN_DOMAIN_RID, windows.DOMAIN_ALIAS_RID_ADMINS,
		0, 0, 0, 0, 0, 0, &sid)
	defer windows.FreeSid(sid)
	token := windows.Token(0)
	member, err := token.IsMember(sid)
	return err == nil && member
}

func relaunchAsAdmin() {
	exe, _ := os.Executable()
	verbPtr, _ := syscall.UTF16PtrFromString("runas")
	exePtr, _ := syscall.UTF16PtrFromString(exe)
	dirPtr, _ := syscall.UTF16PtrFromString(filepath.Dir(exe))
	shell32.NewProc("ShellExecuteW").Call(
		0,
		uintptr(unsafe.Pointer(verbPtr)),
		uintptr(unsafe.Pointer(exePtr)),
		0,
		uintptr(unsafe.Pointer(dirPtr)),
		1, // SW_SHOWNORMAL
	)
}

func doUninstall(installDir string) {
	res := messageBox(appName+" Uninstaller",
		fmt.Sprintf("This will remove %s from your computer.\n\nContinue?", appName),
		MB_YESNO|MB_ICONQUESTION)
	if res != IDYES {
		return
	}

	// Stop running instances
	stopDCC()

	// Remove files
	_ = os.RemoveAll(installDir)

	// Remove Start Menu folder
	startMenu := getCommonStartMenuDir()
	_ = os.RemoveAll(filepath.Join(startMenu, installSubDir))

	// Remove Desktop shortcut
	desktop := getDesktopDir()
	_ = os.Remove(filepath.Join(desktop, appName+".lnk"))

	// Remove registry key
	_ = registry.DeleteKey(registry.LOCAL_MACHINE, uninstallRegKey)

	messageBox(appName+" Uninstaller",
		appName+" has been successfully uninstalled.", MB_OK|MB_ICONINFORMATION)
}

func stopDCC() {
	cmd := exec.Command("taskkill", "/F", "/IM", "dcc.exe")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Run()
}

func main() {
	// Windows-only guard
	if runtime.GOOS != "windows" {
		fmt.Fprintln(os.Stderr, "This installer is for Windows only.")
		os.Exit(1)
	}

	// Handle /uninstall flag
	installDir := filepath.Join(getProgramFilesDir(), installSubDir)
	if len(os.Args) > 1 && os.Args[1] == "/uninstall" {
		if !isElevated() {
			relaunchAsAdmin()
			return
		}
		doUninstall(installDir)
		return
	}

	// Require admin for install
	if !isElevated() {
		res := messageBox(appName+" Installer",
			"Administrator privileges are required to install "+appName+".\n\nClick OK to restart as administrator.",
			MB_OKCANCEL|MB_ICONINFORMATION)
		if res == IDOK {
			relaunchAsAdmin()
		}
		return
	}

	// Welcome dialog
	res := messageBox(appName+" "+appVersion+" Installer",
		fmt.Sprintf("Welcome to the %s installer!\n\n"+
			"This will install %s to:\n  %s\n\n"+
			"• Start Menu shortcut will be created\n"+
			"• Desktop shortcut will be created\n"+
			"• The app will launch automatically after install\n\n"+
			"Click OK to continue or Cancel to exit.",
			appName, appName, installDir),
		MB_OKCANCEL|MB_ICONINFORMATION)
	if res != IDOK {
		return
	}

	// Create install directory
	if err := os.MkdirAll(installDir, 0755); err != nil {
		messageBox("Installation Error",
			fmt.Sprintf("Failed to create installation directory:\n%s\n\n%v", installDir, err),
			MB_OK|MB_ICONERROR)
		return
	}

	// Stop any running instance before overwriting
	stopDCC()

	// Write dcc.exe
	dccExePath := filepath.Join(installDir, "dcc.exe")
	if err := os.WriteFile(dccExePath, dccBinary, 0755); err != nil {
		messageBox("Installation Error",
			fmt.Sprintf("Failed to write dcc.exe:\n%v", err),
			MB_OK|MB_ICONERROR)
		return
	}

	// Create Start Menu shortcuts
	startMenu := getCommonStartMenuDir()
	smDir := filepath.Join(startMenu, installSubDir)
	_ = os.MkdirAll(smDir, 0755)

	_ = createShortcut(
		filepath.Join(smDir, appName+".lnk"),
		dccExePath, "", installDir,
		dccExePath+",0",
		"Launch Docker Command Center",
	)
	_ = createShortcut(
		filepath.Join(smDir, "Uninstall "+appName+".lnk"),
		installerExePath(), "/uninstall", installDir,
		installerExePath()+",0",
		"Uninstall Docker Command Center",
	)

	// Copy installer to install dir for uninstall support
	selfPath, _ := os.Executable()
	installerDst := filepath.Join(installDir, "DockerCommandCenter-installer.exe")
	selfData, _ := os.ReadFile(selfPath)
	_ = os.WriteFile(installerDst, selfData, 0755)

	// Desktop shortcut
	desktop := getDesktopDir()
	_ = createShortcut(
		filepath.Join(desktop, appName+".lnk"),
		dccExePath, "", installDir,
		dccExePath+",0",
		"Launch Docker Command Center",
	)

	// Register uninstall entry
	registerUninstall(installDir, installerDst)

	// Launch dcc.exe
	cmd := exec.Command(dccExePath)
	cmd.Dir = installDir
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: false}
	if err := cmd.Start(); err != nil {
		messageBox("Launch Error",
			fmt.Sprintf("Installation succeeded but failed to launch %s:\n%v\n\nYou can start it from the Start Menu.", appName, err),
			MB_OK|MB_ICONERROR)
	} else {
		// Give the server a moment to start then open browser
		time.Sleep(2 * time.Second)
		openBrowser("http://localhost:" + appPort)
	}

	messageBox(appName+" Installed",
		fmt.Sprintf("%s has been successfully installed!\n\n"+
			"• Installed to: %s\n"+
			"• Access at: http://localhost:%s\n"+
			"• Start Menu shortcut created\n"+
			"• Desktop shortcut created\n\n"+
			"The application is now running.",
			appName, installDir, appPort),
		MB_OK|MB_ICONINFORMATION)
}

func installerExePath() string {
	installDir := filepath.Join(getProgramFilesDir(), installSubDir)
	return filepath.Join(installDir, "DockerCommandCenter-installer.exe")
}

func openBrowser(url string) {
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Start()
}
