#!/bin/bash
# =============================================================================
# Splunk Demo Container Entrypoint
# =============================================================================
# Displays welcome message, verifies connections, and starts session timer.
# =============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

# Session timeout (default: 60 minutes)
SESSION_TIMEOUT_MINUTES="${SESSION_TIMEOUT_MINUTES:-60}"
SESSION_TIMEOUT_SECONDS=$((SESSION_TIMEOUT_MINUTES * 60))

# Setup Claude authentication
if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
    mkdir -p /home/devuser/.claude
    CLAUDE_JSON="/home/devuser/.claude/.claude.json"
    if [ -f "$CLAUDE_JSON" ]; then
        jq '. + {hasCompletedOnboarding: true, bypassPermissionsModeAccepted: true}' "$CLAUDE_JSON" > "${CLAUDE_JSON}.tmp" && mv "${CLAUDE_JSON}.tmp" "$CLAUDE_JSON"
    else
        echo '{"hasCompletedOnboarding": true, "bypassPermissionsModeAccepted": true}' > "$CLAUDE_JSON"
    fi
    chmod 600 "$CLAUDE_JSON"
fi

# Display welcome message
clear
cat /etc/motd

# Verify Claude credentials
echo -e "${CYAN}Checking connections...${NC}"

if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
    echo -e "  ${GREEN}+${NC} Claude OAuth token configured"
elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    echo -e "  ${GREEN}+${NC} Claude API key configured"
else
    echo -e "  ${YELLOW}!${NC} No Claude credentials (set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY)"
fi

# Verify Splunk connection
if [ -n "$SPLUNK_URL" ] && [ -n "$SPLUNK_USERNAME" ] && [ -n "$SPLUNK_PASSWORD" ]; then
    echo -e "  ${GREEN}+${NC} Splunk credentials configured"

    # Quick connectivity test
    if curl -sf -k -u "${SPLUNK_USERNAME}:${SPLUNK_PASSWORD}" \
        "${SPLUNK_URL}/services/server/info" > /dev/null 2>&1; then
        echo -e "  ${GREEN}+${NC} Connected to Splunk"
    else
        echo -e "  ${YELLOW}!${NC} Splunk connection test failed (server may still be starting)"
    fi
else
    echo -e "  ${RED}x${NC} Splunk credentials not configured"
fi

echo ""
echo -e "${CYAN}Session Info:${NC}"
echo -e "  Duration: ${SESSION_TIMEOUT_MINUTES} minutes"
echo -e "  Started:  $(date '+%H:%M:%S %Z')"
echo ""

# Start session timer in background
(
    # Warning at 5 minutes remaining
    warning_time=$((SESSION_TIMEOUT_SECONDS - 300))
    if [ $warning_time -gt 0 ]; then
        sleep $warning_time
        echo ""
        echo -e "${YELLOW}+--------------------------------------------------------------+${NC}"
        echo -e "${YELLOW}|  5 MINUTES REMAINING - Your session will end soon           |${NC}"
        echo -e "${YELLOW}+--------------------------------------------------------------+${NC}"
        echo ""
        sleep 300
    else
        sleep $SESSION_TIMEOUT_SECONDS
    fi

    # Session timeout
    echo ""
    echo -e "${RED}+--------------------------------------------------------------+${NC}"
    echo -e "${RED}|  SESSION TIMEOUT - Your 1-hour demo has ended               |${NC}"
    echo -e "${RED}|                                                              |${NC}"
    echo -e "${RED}|  Thank you for trying Splunk Assistant Skills!              |${NC}"
    echo -e "${RED}|  Visit: github.com/grandcamel/splunk-assistant-skills       |${NC}"
    echo -e "${RED}+--------------------------------------------------------------+${NC}"
    echo ""

    # Give user a moment to see the message, then exit
    sleep 5
    kill -TERM $$ 2>/dev/null
) &

# Trap to clean up timer on exit
cleanup() {
    jobs -p | xargs -r kill 2>/dev/null
}
trap cleanup EXIT

# Install Splunk Assistant Skills CLI from PyPI
echo -e "${CYAN}Installing Splunk Assistant Skills...${NC}"
if pip install --quiet --no-cache-dir splunk-as 2>/dev/null; then
    CLI_VERSION=$(pip show splunk-as 2>/dev/null | grep Version | cut -d' ' -f2)
    echo -e "  ${GREEN}+${NC} splunk-as CLI v${CLI_VERSION} installed"
else
    echo -e "  ${YELLOW}!${NC} CLI installation failed"
fi

# Install Splunk Assistant Skills plugin from marketplace
rm -rf ~/.claude/plugins 2>/dev/null || true
claude plugin marketplace add https://github.com/grandcamel/splunk-assistant-skills.git#main >/dev/null 2>&1 || true
claude plugin install splunk-assistant-skills@splunk-assistant-skills --scope user >/dev/null 2>&1 || true
INSTALLED_VERSION=$(cat ~/.claude/plugins/cache/*/splunk-assistant-skills/*/plugin.json 2>/dev/null | jq -r '.version' | head -1)
if [ -n "$INSTALLED_VERSION" ]; then
    echo -e "  ${GREEN}+${NC} Claude plugin v${INSTALLED_VERSION} ready"
else
    echo -e "  ${YELLOW}!${NC} Plugin installation failed (will retry on first use)"
fi
echo ""
echo -e "${YELLOW}Press Enter to continue...${NC}"
read -r

# =============================================================================
# Interactive Startup Menu
# =============================================================================

show_menu() {
    echo -e "${CYAN}+--------------------------------------------------------------+${NC}"
    echo -e "${CYAN}|                  Splunk Assistant Demo                       |${NC}"
    echo -e "${CYAN}+--------------------------------------------------------------+${NC}"
    echo -e "${CYAN}|${NC}  ${GREEN}1)${NC} View Scenarios                                            ${CYAN}|${NC}"
    echo -e "${CYAN}|${NC}  ${GREEN}2)${NC} Start Claude (interactive mode)                          ${CYAN}|${NC}"
    echo -e "${CYAN}|${NC}  ${GREEN}3)${NC} Start Bash Shell                                         ${CYAN}|${NC}"
    echo -e "${CYAN}|${NC}  ${GREEN}q)${NC} Exit                                                     ${CYAN}|${NC}"
    echo -e "${CYAN}+--------------------------------------------------------------+${NC}"
    echo ""
}

show_scenarios_menu() {
    echo ""
    echo -e "${CYAN}Available Scenarios:${NC}"
    echo -e "  ${GREEN}1)${NC} DevOps Engineer    - CI/CD, deployments, containers"
    echo -e "  ${GREEN}2)${NC} SRE / On-Call      - Errors, latency, incidents"
    echo -e "  ${GREEN}3)${NC} Support Engineer   - Sessions, tickets, user errors"
    echo -e "  ${GREEN}4)${NC} Management         - KPIs, compliance, capacity"
    echo -e "  ${GREEN}5)${NC} Search Basics      - SPL fundamentals"
    echo -e "  ${GREEN}b)${NC} Back to main menu"
    echo ""
}

view_scenario() {
    local file="$1"
    if [ -f "$file" ]; then
        clear
        glow -p "$file"
    else
        echo -e "${RED}Scenario file not found: $file${NC}"
        sleep 2
    fi
}

scenarios_loop() {
    while true; do
        clear
        cat /etc/motd
        show_scenarios_menu
        read -rp "Select scenario: " choice
        case $choice in
            1) view_scenario "/workspace/scenarios/devops.md" ;;
            2) view_scenario "/workspace/scenarios/sre.md" ;;
            3) view_scenario "/workspace/scenarios/support.md" ;;
            4) view_scenario "/workspace/scenarios/management.md" ;;
            5) view_scenario "/workspace/scenarios/search.md" ;;
            b|B) return ;;
            *) echo -e "${YELLOW}Invalid option${NC}"; sleep 1 ;;
        esac
    done
}

main_menu_loop() {
    while true; do
        clear
        cat /etc/motd
        show_menu
        read -rp "Select option: " choice
        case $choice in
            1)
                scenarios_loop
                ;;
            2)
                clear
                echo -e "${GREEN}Starting Claude in interactive mode...${NC}"
                echo -e "${YELLOW}Tip: Type 'exit' or press Ctrl+C to return to menu${NC}"
                echo ""
                claude --dangerously-skip-permissions "Hello! I'm ready to help you explore Splunk. Try asking about errors, deployments, or customer sessions." || true
                ;;
            3)
                clear
                echo -e "${GREEN}Starting Bash shell...${NC}"
                echo -e "${YELLOW}Tip: Type 'exit' to return to menu${NC}"
                echo -e "${YELLOW}     Run 'claude --dangerously-skip-permissions' to start Claude${NC}"
                echo -e "${YELLOW}     Run 'splunk-as search oneshot \"index=demo_sre | head 10\"' to test CLI${NC}"
                echo ""
                /bin/bash -l || true
                ;;
            q|Q)
                echo -e "${GREEN}Goodbye! Thanks for trying Splunk Assistant Skills.${NC}"
                exit 0
                ;;
            *)
                echo -e "${YELLOW}Invalid option${NC}"
                sleep 1
                ;;
        esac
    done
}

# Start the interactive menu
main_menu_loop
