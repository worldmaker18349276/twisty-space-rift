import numpy as np
from matplotlib import cm
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

plt.style.use('dark_background')

# Generate data points
n = 100
theta = np.linspace(0, 2 * np.pi, n)
r = np.linspace(0.01, 1, n)
R, Theta = np.meshgrid(r, theta)

# Calculate x and y components of z
zscale = 1
X = R * np.cos(Theta)
Y = R * np.sin(Theta)
Z1 = np.sqrt(R) * np.sin(Theta / 2) * zscale
Z2 = -np.sqrt(R) * np.sin(Theta / 2) * zscale
C1 = cm.hsv(Theta / (np.pi*4))
C2 = cm.hsv(0.5 + Theta / (np.pi*4))

# Create figure and 3D axis
fig = plt.figure(figsize=(10, 7))
ax = fig.add_subplot(111, projection='3d')
ax.set_box_aspect((np.ptp(X), np.ptp(X), np.ptp(Z1)))

# Plot two sheets of the Riemann surface
ax.plot_surface(X, Y, Z1, rstride=5, cstride=15, facecolors=C1)
ax.plot_surface(X, Y, Z2, rstride=5, cstride=15, facecolors=C2)
ax.plot_wireframe(X, Y, Z1, rstride=5, cstride=15, color='black', linewidths=1)
ax.plot_wireframe(X, Y, Z2, rstride=5, cstride=15, color='black', linewidths=1)

ax.set_xticklabels("")
ax.set_yticklabels("")
ax.set_zticklabels("")

plt.show()
