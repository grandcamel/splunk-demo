# =============================================================================
# Splunk Assistant Skills Demo Container
# =============================================================================
# Override base image for custom builds (e.g., with zscaler certs):
#   docker build --build-arg BASE_IMAGE=your-registry/claude-devcontainer:enhanced .
#   make build BASE_IMAGE=your-registry/claude-devcontainer:enhanced
ARG BASE_IMAGE=grandcamel/claude-devcontainer:enhanced
FROM ${BASE_IMAGE}

USER root

# Install glow for terminal markdown rendering
RUN curl -fsSL -o /tmp/glow.tar.gz \
    https://github.com/charmbracelet/glow/releases/download/v2.0.0/glow_2.0.0_Linux_x86_64.tar.gz && \
    tar -xzf /tmp/glow.tar.gz -C /tmp && \
    mv /tmp/glow_2.0.0_Linux_x86_64/glow /usr/local/bin/glow && \
    chmod +x /usr/local/bin/glow && \
    rm -rf /tmp/glow.tar.gz /tmp/glow_2.0.0_Linux_x86_64

# Copy MOTD (welcome message)
COPY motd /etc/motd
RUN chmod 644 /etc/motd

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

# Copy guided scenario documentation
COPY scenarios/ /workspace/scenarios/
RUN chown -R devuser:node /workspace/scenarios

# Install Python dependencies for skill-test telemetry
RUN pip install --no-cache-dir requests opentelemetry-api opentelemetry-sdk \
    opentelemetry-exporter-otlp-proto-http splunk-assistant-skills-lib

# Create demo working directory
RUN mkdir -p /workspace/demo && chown devuser:node /workspace/demo

# Copy Claude settings (bypass permission prompts for demo)
COPY settings.json /home/devuser/.claude/settings.json
RUN chown devuser:node /home/devuser/.claude/settings.json && \
    mkdir -p /home/devuser/.claude/plugins/marketplaces /home/devuser/.claude/plugins/cache && \
    chown -R devuser:node /home/devuser/.claude

USER devuser

# Pre-install Splunk Assistant Skills plugin
RUN claude plugin marketplace add https://github.com/grandcamel/splunk-assistant-skills.git#main || true && \
    claude plugin install splunk-assistant-skills@splunk-assistant-skills --scope user || true

USER root

# Ensure cargo bin is in PATH for all shells
RUN echo 'export PATH="/usr/local/cargo/bin:$PATH"' >> /home/devuser/.bashrc && \
    echo 'export PATH="/usr/local/cargo/bin:$PATH"' >> /home/devuser/.profile

# Remove zoxide references from bashrc (not installed in this image)
RUN sed -i '/zoxide/d; /alias cd="z"/d' /home/devuser/.bashrc 2>/dev/null || true

USER devuser

ENV SPLUNK_PROFILE=demo
ENV CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
ENV DEMO_SESSION=true
ENV PATH="/usr/local/cargo/bin:${PATH}"

WORKDIR /workspace/demo

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/bin/bash", "-l"]
