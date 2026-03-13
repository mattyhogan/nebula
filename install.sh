#!/bin/bash
set -e

REPO="mattyhogan/nebula"
MODIFY_PATH=true

for arg in "$@"; do
    case "$arg" in
        --no-modify-path) MODIFY_PATH=false ;;
    esac
done

echo "Installing Nebula CLI..."

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
    x86_64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

BINARY="nebula-${OS}-${ARCH}"
INSTALL_DIR="${HOME}/.local/bin"

mkdir -p "$INSTALL_DIR"

echo "Fetching latest release..."
LATEST=$(curl -fsSL https://api.github.com/repos/$REPO/releases/latest | grep '"tag_name"' | cut -d'"' -f4)

if [ -z "$LATEST" ]; then
    echo "Error: Could not fetch latest release"
    exit 1
fi

echo "Downloading $BINARY ($LATEST)..."
curl -fsSL "https://github.com/$REPO/releases/download/$LATEST/$BINARY" -o "$INSTALL_DIR/nebula"
chmod +x "$INSTALL_DIR/nebula"

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    export PATH="$INSTALL_DIR:$PATH"

    if [[ "$MODIFY_PATH" == true ]]; then
        SHELL_NAME=$(basename "$SHELL")
        case "$SHELL_NAME" in
            zsh)  PROFILE="$HOME/.zshrc" ;;
            bash)
                if [[ -f "$HOME/.bash_profile" ]]; then
                    PROFILE="$HOME/.bash_profile"
                else
                    PROFILE="$HOME/.bashrc"
                fi
                ;;
            *)    PROFILE="" ;;
        esac

        LINE='export PATH="$HOME/.local/bin:$PATH"'
        if [[ -n "$PROFILE" ]] && ! grep -qF '.local/bin' "$PROFILE" 2>/dev/null; then
            echo "" >> "$PROFILE"
            echo "$LINE" >> "$PROFILE"
            echo "Added $INSTALL_DIR to PATH in $PROFILE"
        fi
    else
        echo "Skipping shell profile modification (--no-modify-path)"
        echo "Add to your shell profile manually:"
        echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    fi
fi

echo ""
echo "Nebula $LATEST installed!"
echo ""
echo "Run 'nebula --help' to get started."
