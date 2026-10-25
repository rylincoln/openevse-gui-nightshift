# OpenEVSE charger UI

The web app an owner or installer uses to watch and steer one OpenEVSE
charger: what it is doing now, which part of the system decided that, and the
defaults, rules, limits and energy features that decide what it does next.

## Language

### The hardware

**Charger**:
The whole installed unit a vehicle plugs into: controller, WiFi module, relay
and cable.
_Avoid_: station, EVSE, unit

**Controller**:
The board inside the charger that drives the pilot, switches the relay and
runs the safety checks. It is the only part that can make charging start or
stop.
_Avoid_: EVSE board, main board, "the controller" for a load sharing role

**WiFi module**:
The board that hosts this app, talks to the network and integrations, and
tells the controller what to do.
_Avoid_: gateway, ESP32, WiFi board

**Vehicle**:
The car plugged into the charger.
_Avoid_: EV

**Pilot**:
The signal the charger sends the vehicle to say whether it may charge and how
much current it may draw.
_Avoid_: PWM, J1772 signal

**Relay**:
The switch that connects mains power to the cable, closed only while
charging.
_Avoid_: contactor

**Service level**:
Whether the charger is supplying L1 (about 120 V) or L2 (about 240 V), set by
hand or detected.

### Current

**Hardware maximum**:
A permanent ceiling the installer writes into the controller once, to match
the circuit. Nothing can raise the current above it.
_Avoid_: hard max

**Maximum current**:
The highest current the owner lets the charger offer, at or below the hardware
maximum.
_Avoid_: soft max, max current (alone)

**Minimum current**:
The lowest current the pilot can advertise while still allowing charging.

**Charge rate**:
The current the winning client asks the vehicle to draw.
_Avoid_: charge current, set point, amps

**Current cap**:
A ceiling a client puts on the current, such as the load shaper, load sharing
or temperature throttle. A cap is decided separately from the charge rate.
_Avoid_: max current (for a client's ceiling), throttle (for anything but
temperature)

**Pilot current**:
The current the pilot actually advertises: the lowest of maximum current,
current cap and charge rate, never below minimum current.
_Avoid_: offered current

**Charging current**:
The current the vehicle is measured to draw. It can sit below the pilot
current.
_Avoid_: current (alone), amps

### Charger state

**Charger state**:
What the controller is doing right now. It is one of Starting, Ready,
Connected, Charging, Sleeping, Disabled or Fault.
_Avoid_: EVSE state, status

**Starting**:
The controller is booting and running its power-up safety checks.

**Ready**:
No vehicle is plugged in, and the charger would charge one that arrived.
_Avoid_: idle, not connected, available

**Connected**:
A vehicle is plugged in and allowed to charge, but it is not drawing power.
That is the vehicle's choice: it is full, or it runs its own schedule.
_Avoid_: paused, plugged in

**Charging**:
Power is flowing to the vehicle.

**Sleeping**:
The charger is withholding power but still watching the plug, so it notices a
vehicle arriving or leaving.
_Avoid_: standby, off

**Disabled**:
The charger is withholding power and has stopped watching the plug, so
plugging in and unplugging go unnoticed until it is re-enabled.
_Avoid_: off

**Fault**:
The controller stopped charging because a safety check failed. It retries, or
waits for the problem to be fixed.
_Avoid_: error

**Paused**:
Charging is being withheld by a decision (the owner, a scheduled rule, a
charge limit, eco waiting for surplus) rather than by the vehicle or a fault.
A paused charger is Sleeping, or Disabled when configured that way.
_Avoid_: stopped, suspended

### Who decides

**Client**:
Any part of the system that can try to steer charging: the owner, scheduled
rules, solar divert, boost, a charge limit, the load shaper, RFID, OCPP,
temperature throttle and others. Each client has a fixed rank.
_Avoid_: service, source

**Claim**:
A client's standing request to allow or stop charging, set the charge rate,
or cap the current. It lasts until the client releases it. Each of the three
is settled separately, and the highest-ranked claim wins each one.
_Avoid_: override (for the general idea), request

**Owner (of a decision)**:
The client whose claim is currently winning, shown as "Set by …" or
"Controlled by …". The person who owns the charger is just "the owner".
_Avoid_: controller

**Default state**:
Whether the charger is Active or Disabled when no client claims otherwise. It
is the baseline the charger falls back to every time the last claim is
released, not only at power-up.
_Avoid_: power-up state, start-up state

**Active**:
The default state in which the charger offers power whenever nothing claims
otherwise.
_Avoid_: enabled, on

**Default charge rate**:
The charge rate used when no client sets one.
_Avoid_: default current

**Manual override**:
The claim the owner makes by picking On or Off on the dashboard. It beats
scheduled rules, solar divert and boost. It loses to RFID, OCPP, a reached
charge limit and safety.
_Avoid_: manual (alone), override (alone)

**Auto-release**:
A claim that ends on its own when the vehicle unplugs. The dashboard's On and
Off do not auto-release: they stay until the owner picks Auto or Eco.
_Avoid_: one-shot, per-session

### Charge mode

**Charge mode**:
The dashboard's single choice of who drives charging: Off, Auto, Eco or On.
_Avoid_: mode (alone), state

**Off**:
A manual override that stops charging until the owner picks another charge
mode.
_Avoid_: disable, stop

**On**:
A manual override that charges now, whatever the schedule or solar says,
until the owner picks another charge mode.
_Avoid_: force, start

**Auto**:
No manual override. The default state, scheduled rules, charge limits and
energy features decide, and solar divert (if enabled) does not hold charging
back.
_Avoid_: fast, normal

**Eco**:
Auto, except solar divert sets the charge rate from surplus, and the charger
waits whenever there isn't enough.
_Avoid_: solar mode, divert mode

**Locked**:
The charge mode can't be changed from the dashboard because RFID or OCPP owns
the decision.
_Avoid_: disabled (for the control)

### Sessions, limits and boost

**Session**:
One vehicle's visit, from plug-in to unplug. Its energy and elapsed charging
time start again with the next plug-in.
_Avoid_: charge (as a noun), transaction (outside OCPP)

**Charge limit**:
A target that stops charging when it is reached: charging time, session
energy, state of charge, or range.
_Avoid_: stop condition, cap

**User limit**:
A charge limit set for the current session only. It clears at unplug.
_Avoid_: session limit

**Default limit**:
A charge limit the charger applies to every session that has no user limit.
_Avoid_: system limit, global limit, always-on limit

**Limit reached**:
The active charge limit's target has been met. Charging stays off until the
vehicle unplugs.
_Avoid_: complete, done

**Boost**:
A temporary push to charge now until a target is met (time, added energy,
state of charge or range), after which whatever was in control takes over
again. It beats scheduled rules and solar divert, but not a manual override
or a charge limit, and a reboot clears it.
_Avoid_: force charge, override

### Charge Manager

**Charge Manager**:
The screen where the owner sets how the charger behaves when nobody is
touching it: charger defaults, always-active features and scheduled rules.
_Avoid_: schedule page, automation

**Charger defaults**:
The default state and default charge rate taken together.
_Avoid_: station defaults

**Always-active feature**:
A limit, energy or access feature turned on for every session regardless of
time: default limit, solar divert, load shaper, RFID or OCPP.
_Avoid_: global feature, always on

**Scheduled rule**:
A weekly time window, on chosen days, in which the charger applies one rule
action and optionally a charge limit.
_Avoid_: timer, conditional rule, schedule entry

**Rule action**:
What a scheduled rule does during its window: charge at a rate, disable, eco,
load shaper, RFID or OCPP.

**Open-ended rule**:
A scheduled rule with no stop time. It stays in effect until another rule
starts.

**Schedule event**:
One timed switch in the charger's week: "at this time, on these days, become
Active or Disabled". A scheduled rule is made of one or two of them.
_Avoid_: alarm, timer (in user-facing text)

**Plan**:
The charger's own view of its schedule: what is in effect now and the next
switch.
_Avoid_: forecast, upcoming

### Energy management

**Solar divert**:
The feature that matches the charge rate to the solar surplus available.
_Avoid_: self-production, excess power charging, PV divert

**Surplus**:
Power the home makes or exports that would otherwise go to the grid. It is
what solar divert gives the vehicle.
_Avoid_: excess, spare power

**Divert input**:
What solar divert measures to find the surplus: solar production, or grid
import/export.
_Avoid_: divert type

**Load shaper**:
The feature that caps the charger's current so the home's total draw stays
under a set maximum.
_Avoid_: grid shaping, current shaper, grid limit

**Live power**:
The home's measured total draw, which the load shaper compares with its
maximum.
_Avoid_: house load, grid power

**Load sharing group**:
Chargers on one shared supply that split a single current budget between
them.
_Avoid_: cluster, fleet

**Coordinator**:
The charger in a load sharing group that works out every charger's share.
_Avoid_: controller (taken by the board), master, leader

**Member**:
A charger in a load sharing group that charges within the share the
coordinator gives it.
_Avoid_: slave, follower

**Peer**:
Any other charger in the same load sharing group.

**Allocation**:
The share of the group's budget currently given to one charger, with the
reason for it.
_Avoid_: quota

**Failsafe**:
The safe low current a member falls back to when it can't hear the
coordinator.

**Temperature throttle**:
Lowers the current cap as the charger heats up, before the over-temperature
fault would stop charging.
_Avoid_: thermal limit

**Over-temperature fault**:
The fault the controller raises when the charger, or a cable with cable
temperature sensing, passes its threshold.
_Avoid_: panic, over-temp shutdown

### Vehicle and access

**Vehicle data source**:
Where the charger learns the vehicle's state of charge and range.
_Avoid_: vehicle integration, car API

**State of charge**:
How full the vehicle's battery is, in percent, known only through a vehicle
data source. Shortened to SOC.
_Avoid_: battery level, charge level

**Range**:
The vehicle's estimated driving distance, known only through a vehicle data
source.
_Avoid_: distance, miles, km

**RFID authorization**:
An access feature in which charging waits until an allowed tag is presented.
_Avoid_: card login

**Tag**:
An RFID card or fob registered with the charger.
_Avoid_: card, badge

**OCPP**:
Control of the charger by a remote central system, using the Open Charge
Point Protocol.
_Avoid_: cloud control

**Central system**:
The remote OCPP back office the charger answers to.
_Avoid_: backend, CSMS, server

**evcc**:
An external energy manager that steers the charger as a client of its own.

### Health and safety

**Safety check**:
One of the controller's tests (ground, GFCI, stuck relay, vehicle diode,
temperature), run before and during charging.

**Fault counter**:
How many times one kind of fault (GFCI, no ground, stuck relay) has happened
since the counters were last reset.

**Advisory**:
A message the charger raises about its own health, in the category safety,
fault, thermal or wear, at severity info, warning or critical.
_Avoid_: notification, alarm

**Mute**:
To silence an advisory without fixing what caused it.
_Avoid_: acknowledge, dismiss, ack

**Alert**:
A message the app shows about the app itself, such as a failed save or a lost
connection.
_Avoid_: advisory (for app messages)

**Heartbeat**:
A keep-alive the WiFi module sends the controller. If it stops arriving, the
controller drops to a fallback current.
_Avoid_: watchdog

**Boot lock**:
A controller setting that keeps the charger Disabled after power-up until the
WiFi module releases it.
_Avoid_: startup lock

**Relay health**:
The controller's running assessment of the relay (relay life, hot switches,
switching-time drift, contact heating), surfaced as wear and thermal
advisories before it becomes a fault.

**Relay life**:
The controller's estimate, in percent, of how much switching life the relay
contacts have left.
_Avoid_: relay wear, relay health (for the number)

**Hot switch**:
The relay opening while current is still flowing, which wears the contacts far
faster than a cold open at zero current.
_Avoid_: hot break, arc

**Stuck-relay recovery**:
The controller's attempt to free a stuck relay contact by cycling the relay,
made only when no vehicle is plugged in.
_Avoid_: unstick, relay exercise

**Cable temperature**:
Readings from temperature sensors built into the vehicle cable or the supply
cable. A cable past its threshold causes an over-temperature fault.
_Avoid_: NTC, plug temperature

### The app

**Capability**:
A feature the connected firmware supports, known from whether the firmware
reports it at all. A missing capability means the feature is hidden, never
broken.
_Avoid_: feature flag, version check

**Labs**:
The owner's opt-in to preview features, saved on the charger.
_Avoid_: beta, experimental

**Installer tools**:
Password-protected settings that change the installation itself, such as
writing the hardware maximum.
_Avoid_: advanced settings

**Setup wizard**:
The guided first-run setup, shown until it has been finished once.
_Avoid_: onboarding

**History entry**:
One line of the charger's event log: a change of charger state, with the time
and the readings at that moment.
_Avoid_: log line, event (alone)
